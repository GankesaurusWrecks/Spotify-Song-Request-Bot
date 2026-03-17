### What You'll Need
•       nodejs.org: Node.js installed, download from https://nodejs.org/

•       Spotify Premium account

•       A secondary Twitch account to use as the bot

### Part 1 - Install & Set Up Spotify
1.    Install the Spotify desktop app and sign into your main Spotify account.
2.    Go to [developer.spotify.com/dashboard](url) and log in with your Spotify account.
3.    Click Create App and fill in:
     a.    App Name: anything (e.g. Stream Song Request)
     b.    Description: !Sr song requester
     c.     Redirect URI: http://127.0.0.1:8888/callback
     d.    Check the box for Web API
4.    Click Save.
5.    Click Settings on your new app.
6.    Copy your Client ID and Client Secret: paste both into a temporary text file for now. You will need them shortly.
 
### Part 2 - Create Your Twitch Bot Account
7.    Create a secondary Twitch account: this will be the bot that responds in chat.

⚠️  Note: Twitch requires new accounts to either have 2-factor authentication enabled, or be at least 1 week old, before they can chat. Set up 2FA on the bot account to use it immediately.
9.    Log into Twitch as the bot account.
10.    Go to twitchtokengenerator.com
11.  Select Custom Scope Token and check these two scopes only:
     e.    chat:read
     f.      chat:edit
12.  Click Generate Token and authorize.
13.  Copy the Access Token that appears and save it in your temporary text file as OAUTH TOKEN.

💡  Tip: Do not copy the Refresh Token or Client ID from this site. Only the Access Token is needed.
 
### Part 3 - Create the Bot Files
13.  Open File Explorer and navigate to your user folder. The path looks like:
 
C:\Users\YourWindowsUsername

 
⚠️  Note: Replace YourWindowsUsername with your actual Windows username. You can find it by opening Command Prompt, it shows at the start of every line.
14.  Create a new folder here called song-request-bot.
15.  Open Command Prompt and run each of these commands one at a time, pressing Enter after each:
 
cd C:\Users\YourWindowsUsername\song-request-bot
npm init -y
npm install tmi.js express axios
npm install open@8.4.2

 
⚠️  Note: The open@8.4.2 version is required, newer versions will cause an error. Do not skip this step or install a different version.
16.  Close the Command Prompt window once all four commands complete successfully.
 
Install config.js
17.  Inside the song-request-bot folder, add the config.txt file to the folder song-request-bot, and open the file.
18.  Fill out the contents for your connections, save it and close the file.
 
⚠️  Note: TWITCH_BOT_USERNAME and TWITCH_CHANNEL must be all lowercase. The COMMAND value must match exactly how Twitch autocorrects it, Twitch capitalizes the first letter after ! so use !Sr not !sr.
19.  Right-click the file, select Rename, and change config.txt to config.js. Click OK on the warning popup.
 
Install bot.js in the song-request-bot folder

20.  In the same folder, install the bot.js file.

### Part 4 - First Run
21.  Open Spotify desktop app and start playing any song. It can be paused after it starts.
22.  Open Command Prompt and run each of the following commands, one after the other pressing enter each time:
 
cd C:\Users\YourWindowsUsername\song-request-bot

node bot.js

23.  Your browser will open to a Spotify authorization page. Click Agree.
24.  You will see a success message in the browser. Close the tab and return to the terminal.
25.  The terminal should show the bot is connected and listening to your Twitch channel.
26.  Launch OBS and go live.
27.  Test the bot by typing in your Twitch chat one of the following prompts:
 
!Sr https://open.spotify.com/track/4PTG3Z6ehGkBFwjybzWkR8

!Sr never going to give you up

The bot should reply in chat and Never Going to Give You Up should appear as the next song in your Spotify queue.

Once it is verified to be working. Let's go back into the C:\Users\Your Windows Username\song-request-bot folder and change bot.js to a bot.txt file by altering its name. Open the text document and search using CTRL+F for "debug: true", change true, to false, then save and close the document. This will save your computer processing power by turning off the functions report in the Command Prompt window.

Change config.txt back to config.js and we’re all set up.

### Every Stream After This
From the second stream onward, Spotify authorization is saved automatically. Just run:
 
28.  Open Spotify and start playing a song.
29.  Open Command Prompt and run:
 
cd C:\Users\YourWindowsUsername\song-request-bot

node bot.js

 
30.  Launch your streaming software and go live.
 
### How Viewers Use It
 
### Command Example
Search by name
!Sr never going to give you up
Paste Spotify link
!Sr https://open.spotify.com/track/...

In testing song links are more stable, but either function works.

### Troubleshooting
Bot connects but songs don't queue

•       Make sure Spotify is open and playing before running the bot.
•       The Spotify desktop app works best, avoid using Spotify in a browser tab.
 
Login authentication failed

•       Your TWITCH_OAUTH_TOKEN is wrong or expired. Go back to twitchtokengenerator.com, log in as the bot account, and generate a new token.
•       Make sure TWITCH_BOT_USERNAME matches the account you generated the token for, in all lowercase.
 
Cannot find module error

•       You are running node bot.js from the wrong folder. Make sure you cd into the song-request-bot folder first.
 
open is not a function error

•       Run: npm uninstall open then npm install open@8.4.2 from inside the song-request-bot folder. To do so open command prompt and enter each command followed by pressing the enter key:

npm uninstall open

npm install open@8.4.2

 
### Part 5 Stream Deck Optional setup
For each button, use the System: Website action and set it to open the URL in the background (no browser window).
Button       URL
▶️ Play     http://127.0.0.1:8888/deck/play

⏸️ Pause    http://127.0.0.1:8888/deck/pause

⏭️ Skip     http://127.0.0.1:8888/deck/skip

🔀 Shuffle  http://127.0.0.1:8888/deck/shuffle

To set "open in background" on Stream Deck:
Add a website action to a button
Paste the URL
Check "Open in background" so it doesn't pop a browser tab every time you press it.

Notes

Shuffle is a toggle; press once to turn on, press again to turn off. The terminal will log Shuffle ON or Shuffle OFF so you can see the state.

The bot must be running (node bot.js) for the buttons to work, same as always.

These buttons only control your Spotify; no chat messages are sent.
