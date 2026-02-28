const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createRoom, joinRoom, getRoom, removePlayer, rooms } = require('./game');
const { checkAnswer } = require('./matcher');

const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 25000, // keep connection alive through Railway's proxy
  pingTimeout: 10000,
  cors: {
    origin: process.env.NODE_ENV === 'production' ? undefined : /^http:\/\/localhost:/,
    methods: ['GET', 'POST'],
  },
});

app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
app.get('*path', (req, res, next) => {
  if (req.url.startsWith('/socket.io')) return next();
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

function triggerPlay(room) {
  clearTimeout(room.prepareTimer);
  if (room.roundPlaying) return;
  room.roundPlaying = true;

  room.roundStartTime = Date.now();
  io.to(room.code).emit('play_now', {
    roundStartTime: room.roundStartTime,
  });

  const song = room.songs[room.currentRound];
  room.timer = setTimeout(() => {
    if (!room.roundAnswered) {
      const scores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
      io.to(room.code).emit('round_timeout', {
        correctAnswer: song.movie,
        scores,
      });
      setTimeout(() => advanceRound(room), 3000);
    }
  }, 32000);
}

function startRound(room) {
  const song = room.songs[room.currentRound];
  room.roundAnswered = false;
  room.roundPlaying = false;
  room.readyPlayers = new Set();

  io.to(room.code).emit('prepare_round', {
    roundNumber: room.currentRound + 1,
    previewUrl: song.previewUrl,
    totalRounds: room.totalRounds,
  });

  room.prepareTimer = setTimeout(() => triggerPlay(room), 10000);
}

function advanceRound(room) {
  room.currentRound++;
  if (room.currentRound >= room.totalRounds) {
    const scores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
    scores.sort((a, b) => b.score - a.score);
    const winner = scores[0];
    io.to(room.code).emit('game_over', {
      finalScores: scores,
      winnerId: winner.id,
      winnerName: winner.name,
    });
    room.state = 'finished';
  } else {
    const disconnectedPlayer = room.players.find(p => p.disconnected);
    if (disconnectedPlayer) {
      // Cancel their individual cleanup timer — the waiting timer is now the deadline.
      clearTimeout(disconnectedPlayer.cleanupTimer);
      room.waitingForPlayer = true;
      io.to(room.code).emit('waiting_for_player', { playerName: disconnectedPlayer.name });
      room.waitingTimer = setTimeout(() => {
        room.waitingForPlayer = false;
        removePlayer(room.code, disconnectedPlayer.id);
        const scores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
        scores.sort((a, b) => b.score - a.score);
        io.to(room.code).emit('game_over', {
          finalScores: scores,
          winnerId: scores[0]?.id,
          winnerName: scores[0]?.name,
        });
        room.state = 'finished';
      }, 30000);
    } else {
      startRound(room);
    }
  }
}

function calculateScore(answerTimestamp, roundStartTime) {
  const elapsed = (answerTimestamp - roundStartTime) / 1000;
  let score = 100;
  if (elapsed <= 5) score += 50;
  else if (elapsed <= 10) score += 25;
  return score;
}

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('join_room', ({ roomCode, playerName }) => {
    if (!playerName || playerName.trim().length === 0) {
      socket.emit('error', { message: 'Please enter a name' });
      return;
    }

    if (!roomCode) {
      const room = createRoom(socket.id, playerName.trim());
      socket.join(room.code);
      socket.emit('room_joined', {
        roomCode: room.code,
        players: room.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
        playerId: socket.id,
        isHost: true,
      });
      console.log(`Room ${room.code} created by ${playerName}`);
    } else {
      const code = roomCode.toUpperCase();
      const room = getRoom(code);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Rejoin path: mid-game reconnect where name matches a disconnected player.
      const disconnectedPlayer = room.players.find(
        p => p.disconnected && p.name.toLowerCase() === playerName.trim().toLowerCase()
      );
      if (disconnectedPlayer) {
        clearTimeout(disconnectedPlayer.cleanupTimer);
        if (room.waitingTimer) {
          clearTimeout(room.waitingTimer);
          room.waitingTimer = null;
        }
        const wasHost = room.hostId === disconnectedPlayer.id;
        if (wasHost) room.hostId = socket.id;
        disconnectedPlayer.id = socket.id;
        disconnectedPlayer.disconnected = false;
        socket.join(code);
        const players = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
        if (room.state === 'lobby') {
          socket.emit('room_joined', { roomCode: code, players, playerId: socket.id, isHost: wasHost });
          socket.to(code).emit('player_joined', { players });
        } else {
          socket.emit('rejoin_game', {
            roomCode: code,
            playerId: socket.id,
            players,
            totalRounds: room.totalRounds,
            currentRound: room.currentRound + 1,
          });
          socket.to(code).emit('player_rejoined', { playerName: disconnectedPlayer.name, players });
          if (room.waitingForPlayer) {
            room.waitingForPlayer = false;
            setTimeout(() => startRound(room), 1500);
          }
        }
        console.log(`${playerName} rejoined room ${code}`);
        return;
      }

      if (room.state !== 'lobby') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }
      if (room.players.some(p => p.name === playerName.trim())) {
        socket.emit('error', { message: 'Name already taken in this room' });
        return;
      }

      joinRoom(code, socket.id, playerName.trim());
      socket.join(code);

      const players = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
      socket.emit('room_joined', {
        roomCode: code,
        players,
        playerId: socket.id,
        isHost: false,
      });
      socket.to(code).emit('player_joined', { players });
      console.log(`${playerName} joined room ${code}`);
    }
  });

  socket.on('start_game', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room) return;
    if (room.hostId !== socket.id) {
      socket.emit('error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.players.length < 1) {
      socket.emit('error', { message: 'Need at least 1 player to start' });
      return;
    }

    room.state = 'playing';
    room.currentRound = 0;
    room.players.forEach(p => (p.score = 0));

    const shuffled = [...room.allSongs].sort(() => Math.random() - 0.5);
    room.songs = shuffled.slice(0, room.totalRounds);

    io.to(roomCode).emit('game_started', { totalRounds: room.totalRounds });
    setTimeout(() => startRound(room), 1000);
  });

  socket.on('round_ready', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room || room.state !== 'playing' || !room.readyPlayers) return;
    room.readyPlayers.add(socket.id);
    const activePlayers = room.players.filter(p => !p.disconnected);
    if (room.readyPlayers.size >= activePlayers.length) {
      triggerPlay(room);
    }
  });

  socket.on('submit_answer', ({ roomCode, answer, timestamp }) => {
    const room = getRoom(roomCode);
    if (!room || room.state !== 'playing' || room.roundAnswered) return;

    const song = room.songs[room.currentRound];
    if (checkAnswer(answer, song)) {
      room.roundAnswered = true;
      clearTimeout(room.timer);

      const points = calculateScore(timestamp, room.roundStartTime);
      const player = room.players.find(p => p.id === socket.id);
      if (player) player.score += points;

      const scores = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
      io.to(roomCode).emit('round_won', {
        winnerId: socket.id,
        winnerName: player?.name || 'Unknown',
        correctAnswer: song.movie,
        pointsAwarded: points,
        scores,
      });

      setTimeout(() => advanceRound(room), 3000);
    }
  });

  socket.on('play_again', ({ roomCode }) => {
    const room = getRoom(roomCode);
    if (!room || room.hostId !== socket.id) return;

    room.state = 'lobby';
    room.currentRound = 0;
    room.roundAnswered = false;
    room.players.forEach(p => (p.score = 0));
    clearTimeout(room.timer);

    const players = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
    io.to(roomCode).emit('back_to_lobby', { players });
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    for (const [code, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) continue;

      if (room.hostId === socket.id) {
        if (room.state === 'lobby') {
          // In lobby: give host 30s to come back before closing the room.
          const player = room.players[playerIndex];
          player.disconnected = true;
          player.cleanupTimer = setTimeout(() => {
            rooms.delete(code);
          }, 30000);
        } else {
          clearTimeout(room.timer);
          clearTimeout(room.prepareTimer);
          clearTimeout(room.waitingTimer);
          io.to(code).emit('error', { message: 'Host disconnected — game ended' });
          rooms.delete(code);
        }
      } else if (room.state === 'playing') {
        // Mid-game: keep the player in the room for 30s so they can reconnect.
        const player = room.players[playerIndex];
        player.disconnected = true;
        player.cleanupTimer = setTimeout(() => {
          removePlayer(code, socket.id);
          const players = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
          io.to(code).emit('player_joined', { players });
        }, 30000);
      } else {
        removePlayer(code, socket.id);
        const players = room.players.map(p => ({ id: p.id, name: p.name, score: p.score }));
        io.to(code).emit('player_joined', { players });
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
