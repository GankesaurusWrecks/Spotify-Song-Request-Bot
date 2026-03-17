const tmi = require('tmi.js');
const express = require('express');
const axios = require('axios');
const open = require('open');
const fs = require('fs');
const config = require('./config');

// ── Token Storage ──────────────────────────────────────────────
const SPOTIFY_TOKEN_FILE = './tokens_spotify.json';
let spotifyTokens = {};

function saveSpotifyTokens(t) {
  spotifyTokens = t;
  fs.writeFileSync(SPOTIFY_TOKEN_FILE, JSON.stringify(t));
}

function loadSpotifyTokens() {
  if (fs.existsSync(SPOTIFY_TOKEN_FILE)) {
    spotifyTokens = JSON.parse(fs.readFileSync(SPOTIFY_TOKEN_FILE));
    return true;
  }
  return false;
}

// ── Spotify Auth ───────────────────────────────────────────────
const SPOTIFY_SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ');

function getSpotifyAuthUrl() {
  const params = new URLSearchParams({
    client_id: config.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: config.SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

async function exchangeSpotifyCode(code) {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(
          `${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64'),
      },
    }
  );
  saveSpotifyTokens({ ...res.data, expires_at: Date.now() + res.data.expires_in * 1000 });
}

async function refreshSpotifyToken() {
  const res = await axios.post(
    'https://accounts.spotify.com/api/token',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: spotifyTokens.refresh_token,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(
          `${config.SPOTIFY_CLIENT_ID}:${config.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64'),
      },
    }
  );
  saveSpotifyTokens({
    ...spotifyTokens,
    access_token: res.data.access_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
  });
  console.log('🔄 Spotify token refreshed');
}

async function getSpotifyToken() {
  if (Date.now() > spotifyTokens.expires_at - 60000) await refreshSpotifyToken();
  return spotifyTokens.access_token;
}

// ── Spotify API Helpers ────────────────────────────────────────
async function getActiveDeviceId() {
  const token = await getSpotifyToken();
  const res = await axios.get('https://api.spotify.com/v1/me/player/devices', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const devices = res.data.devices || [];
  const active = devices.find(d => d.is_active) || devices[0];
  return active ? active.id : null;
}

async function transferPlayback(deviceId) {
  const token = await getSpotifyToken();
  await axios.put(
    'https://api.spotify.com/v1/me/player',
    { device_ids: [deviceId], play: true },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

async function searchTrack(query) {
  const token = await getSpotifyToken();
  const res = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'track', limit: 1 },
  });
  const items = res.data.tracks?.items;
  return items?.length ? items[0] : null;
}

async function addToQueue(trackUri, deviceId) {
  const token = await getSpotifyToken();
  await transferPlayback(deviceId);
  await new Promise(r => setTimeout(r, 500));
  await axios.post(
    `https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(trackUri)}&device_id=${deviceId}`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

// ── Twitch Bot ─────────────────────────────────────────────────
const queue = [];
let twitchClient = null;

function buildTwitchClient(oauthToken) {
  const client = new tmi.Client({
    options: { debug: false },
    connection: { secure: true, reconnect: true },
    identity: {
      username: config.TWITCH_BOT_USERNAME,
      password: `oauth:${oauthToken}`,
    },
    channels: [config.TWITCH_CHANNEL],
  });

  client.on('message', async (channel, tags, message, self) => {
    if (self) return;
    if (!message.startsWith(config.COMMAND)) return;

    const username = tags['display-name'];
    const query = message.slice(config.COMMAND.length).trim();

    if (!query) {
      client.say(channel, `@${username} Usage: ${config.COMMAND} song name or Spotify link`);
      return;
    }

    if (queue.length >= config.MAX_QUEUE) {
      client.say(channel, `@${username} The queue is full (${config.MAX_QUEUE} songs). Try again later!`);
      return;
    }

    try {
      let track;
      if (query.includes('spotify.com/track/')) {
        const trackId = query.split('/track/')[1].split('?')[0];
        const token = await getSpotifyToken();
        const res = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        track = res.data;
      } else {
        track = await searchTrack(query);
      }

      if (!track) {
        client.say(channel, `@${username} Couldn't find that track. Try a different search!`);
        return;
      }

      const deviceId = await getActiveDeviceId();
      if (!deviceId) {
        client.say(channel, `@${username} Spotify doesn't seem to be open. Start playing something first!`);
        return;
      }

      await addToQueue(track.uri, deviceId);
      queue.push({ title: track.name, artist: track.artists[0].name, requestedBy: username });

      const songName = `${track.name} by ${track.artists[0].name}`;
      client.say(channel, `@${username} ✅ Added "${songName}" to the queue! (Position: ${queue.length})`);
      console.log(`🎵 Queued: ${songName} (requested by ${username})`);

    } catch (err) {
      console.error('Song request error:', err.response?.data || err.message);
      client.say(channel, `@${username} Something went wrong adding that song. Is Spotify playing?`);
    }
  });

  return client;
}

// ── Stream Deck Control Endpoints ─────────────────────────────
function streamDeckRoutes(app) {

  // Play
  app.get('/deck/play', async (req, res) => {
    try {
      const token = await getSpotifyToken();
      const deviceId = await getActiveDeviceId();
      if (!deviceId) { res.send('No active Spotify device found.'); return; }
      await axios.put(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('▶️  Play');
      res.send('<h2>▶️ Playing</h2>');
    } catch (err) {
      console.error('Play error:', err.response?.data || err.message);
      res.send('Error: ' + (err.response?.data?.error?.message || err.message));
    }
  });

  // Pause
  app.get('/deck/pause', async (req, res) => {
    try {
      const token = await getSpotifyToken();
      const deviceId = await getActiveDeviceId();
      if (!deviceId) { res.send('No active Spotify device found.'); return; }
      await axios.put(
        `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('⏸️  Pause');
      res.send('<h2>⏸️ Paused</h2>');
    } catch (err) {
      console.error('Pause error:', err.response?.data || err.message);
      res.send('Error: ' + (err.response?.data?.error?.message || err.message));
    }
  });

  // Skip
  app.get('/deck/skip', async (req, res) => {
    try {
      const token = await getSpotifyToken();
      const deviceId = await getActiveDeviceId();
      if (!deviceId) { res.send('No active Spotify device found.'); return; }
      await axios.post(
        `https://api.spotify.com/v1/me/player/next?device_id=${deviceId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Remove the first song from our local queue tracker if present
      if (queue.length > 0) queue.shift();
      console.log('⏭️  Skip');
      res.send('<h2>⏭️ Skipped</h2>');
    } catch (err) {
      console.error('Skip error:', err.response?.data || err.message);
      res.send('Error: ' + (err.response?.data?.error?.message || err.message));
    }
  });

  // Shuffle toggle
  app.get('/deck/shuffle', async (req, res) => {
    try {
      const token = await getSpotifyToken();
      const deviceId = await getActiveDeviceId();
      if (!deviceId) { res.send('No active Spotify device found.'); return; }
      // Get current shuffle state
      const stateRes = await axios.get('https://api.spotify.com/v1/me/player',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const currentShuffle = stateRes.data?.shuffle_state || false;
      const newShuffle = !currentShuffle;
      await axios.put(
        `https://api.spotify.com/v1/me/player/shuffle?state=${newShuffle}&device_id=${deviceId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const label = newShuffle ? 'ON' : 'OFF';
      console.log(`🔀 Shuffle ${label}`);
      res.send(`<h2>🔀 Shuffle ${label}</h2>`);
    } catch (err) {
      console.error('Shuffle error:', err.response?.data || err.message);
      res.send('Error: ' + (err.response?.data?.error?.message || err.message));
    }
  });

}

// ── Startup ────────────────────────────────────────────────────
async function start() {
  const app = express();

  // ── Spotify callback ──
  app.get('/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) { res.send('Error: no code'); return; }
    await exchangeSpotifyCode(code);
    res.send('<h2>✅ Spotify connected! You can close this tab and go back to the terminal.</h2>');
    console.log('\n✅ Spotify authenticated! Connecting to Twitch chat...\n');
    twitchClient = buildTwitchClient(config.TWITCH_OAUTH_TOKEN);
    twitchClient.connect().catch(console.error);
  });

  // ── Stream Deck routes ──
  streamDeckRoutes(app);

  app.listen(8888);
  console.log('🎛️  Stream Deck endpoints ready on http://127.0.0.1:8888/deck/');

  // ── Check saved Spotify tokens ──
  if (loadSpotifyTokens() && spotifyTokens.refresh_token) {
    console.log('✅ Found saved Spotify tokens, refreshing...');
    await refreshSpotifyToken();
    console.log('✅ Spotify ready. Connecting to Twitch chat...\n');
    twitchClient = buildTwitchClient(config.TWITCH_OAUTH_TOKEN);
    twitchClient.connect().catch(console.error);
  } else {
    console.log('🔑 Opening Spotify login in your browser...');
    await open(getSpotifyAuthUrl());
    console.log('Waiting for Spotify authorization...');
  }
}

start().catch(console.error);
