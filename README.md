# BollyQuiz — Bollywood Music Quiz Game

A real-time multiplayer web game where players join a shared room, listen to Bollywood song clips, and race to guess the movie name first.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + Socket.io
- **Answer Matching**: Fuse.js (fuzzy matching)
- **Audio**: Browser native `<audio>` with server-synced playback

## Getting Started

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server runs on `http://localhost:3001`.

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

The client runs on `http://localhost:5173`.

### 3. Play

1. Open `http://localhost:5173` in your browser
2. Click **Create Game** and enter your name
3. Share the 4-letter room code with friends
4. Friends open the same URL, click **Join Game**, and enter the code
5. Host clicks **Start Game** — songs play, everyone guesses!

## How It Works

- Each round, a song clip plays simultaneously for all players
- Players type the Bollywood movie name into the text input
- First correct answer wins the round (fuzzy matching accepts typos and abbreviations like "DDLJ")
- Points: 100 base + speed bonus (50 pts if answered within 5s, 25 pts within 10s)
- After 10 rounds, the final leaderboard reveals the winner

## Project Structure

```
client/          React + Vite frontend
  src/
    components/  Landing, Lobby, Game, Leaderboard, GameOver
    App.jsx      State machine routing
    socket.js    Socket.io client singleton

server/          Node.js backend
  index.js       Express + Socket.io server
  game.js        Room management, game engine
  matcher.js     Fuse.js fuzzy answer matching
  songs.json     Hardcoded song playlist
```

## Notes

- Audio uses placeholder MP3s from SoundHelix — swap `previewUrl` in `songs.json` with real Spotify preview URLs for production
- All game state is in-memory (no database) — restarting the server clears all rooms
- No authentication — players are identified by socket connection + name
