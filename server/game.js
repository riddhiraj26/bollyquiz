const songs = require('./songs.json');

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId, hostName) {
  const code = generateRoomCode();
  const room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, score: 0 }],
    state: 'lobby',
    currentRound: 0,
    totalRounds: 10,
    roundAnswered: false,
    roundStartTime: null,
    songs: [],
    allSongs: [...songs],
    timer: null,
  };
  rooms.set(code, room);
  return room;
}

function joinRoom(code, socketId, playerName) {
  const room = rooms.get(code);
  if (!room) return null;
  room.players.push({ id: socketId, name: playerName, score: 0 });
  return room;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function removePlayer(code, socketId) {
  const room = rooms.get(code);
  if (!room) return;
  room.players = room.players.filter(p => p.id !== socketId);
  if (room.players.length === 0) {
    rooms.delete(code);
  }
}

module.exports = { createRoom, joinRoom, getRoom, removePlayer, rooms };
