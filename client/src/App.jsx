import { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import { unlockAudio } from './audioUnlock';
import { dlog } from './debugLog';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import Game from './components/Game';
import GameOver from './components/GameOver';
import DebugOverlay from './components/DebugOverlay';

export default function App() {
  const [screen, setScreen] = useState('landing');
  const [roomCode, setRoomCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [totalRounds, setTotalRounds] = useState(10);
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    dlog('socket', `connected=${socket.connected}, id=${socket.id || 'none'}`);

    if (!socket.connected) {
      dlog('socket', 'calling connect()...');
      socket.connect();
    }

    const onConnect = () => {
      dlog('socket', `CONNECTED id=${socket.id}`);
    };
    const onDisconnect = (reason) => {
      dlog('socket', `DISCONNECTED reason=${reason}`);
    };
    const onConnectError = (err) => {
      dlog('error', `connect_error: ${err.message}`);
    };

    const onRoomJoined = (data) => {
      dlog('recv', `room_joined room=${data.roomCode} isHost=${data.isHost}`);
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setIsHost(data.isHost);
      setPlayers(data.players);
      setError('');
      setScreen('lobby');
    };

    const onPlayerJoined = (data) => {
      dlog('recv', `player_joined count=${data.players.length}`);
      setPlayers(data.players);
    };

    const onGameStarted = (data) => {
      dlog('recv', `game_started rounds=${data.totalRounds}`);
      setTotalRounds(data.totalRounds);
      setScreen('game');
    };

    const onGameOver = (data) => {
      dlog('recv', 'game_over');
      setScores(data.finalScores);
      setScreen('gameOver');
    };

    const onBackToLobby = (data) => {
      dlog('recv', 'back_to_lobby');
      setPlayers(data.players);
      setScores([]);
      setScreen('lobby');
    };

    const onError = (data) => {
      dlog('error', `server error: ${data.message}`);
      setError(data.message);
      if (data.message === 'Host disconnected — game ended') {
        setScreen('landing');
        setRoomCode('');
        setPlayers([]);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room_joined', onRoomJoined);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);
    socket.on('game_over', onGameOver);
    socket.on('back_to_lobby', onBackToLobby);
    socket.on('error', onError);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room_joined', onRoomJoined);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_started', onGameStarted);
      socket.off('game_over', onGameOver);
      socket.off('back_to_lobby', onBackToLobby);
      socket.off('error', onError);
    };
  }, []);

  // Connects if needed, then calls fn() once the socket is open.
  // Shows a connecting spinner and surfaces any connection error.
  const connectThenEmit = useCallback((fn) => {
    if (socket.connected) {
      fn();
      return;
    }
    dlog('socket', 'not connected — connecting first...');
    setConnecting(true);

    const onConnect = () => {
      socket.off('connect_error', onError);
      setConnecting(false);
      fn();
    };
    const onError = (err) => {
      socket.off('connect', onConnect);
      setConnecting(false);
      setError(`Can't reach server: ${err.message}`);
      dlog('error', `connect failed: ${err.message}`);
    };

    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
    socket.connect();
  }, []);

  const handleCreateRoom = useCallback((name) => {
    dlog('emit', `join_room (create) name="${name}" connected=${socket.connected}`);
    unlockAudio();
    setPlayerName(name);
    connectThenEmit(() => socket.emit('join_room', { playerName: name }));
  }, [connectThenEmit]);

  const handleJoinRoom = useCallback((name, code) => {
    dlog('emit', `join_room code=${code} name="${name}" connected=${socket.connected}`);
    unlockAudio();
    setPlayerName(name);
    connectThenEmit(() => socket.emit('join_room', { roomCode: code, playerName: name }));
  }, [connectThenEmit]);

  const handleStartGame = useCallback(() => {
    dlog('emit', `start_game room=${roomCode} connected=${socket.connected}`);
    unlockAudio();
    socket.emit('start_game', { roomCode });
  }, [roomCode]);

  const handleLeave = useCallback(() => {
    dlog('info', 'leaving game, disconnect + reconnect');
    socket.disconnect();
    socket.connect();
    setScreen('landing');
    setRoomCode('');
    setPlayers([]);
    setScores([]);
    setError('');
  }, []);

  const handlePlayAgain = useCallback(() => {
    dlog('emit', `play_again room=${roomCode}`);
    socket.emit('play_again', { roomCode });
  }, [roomCode]);

  return (
    <div className="min-h-screen flex flex-col">
      {screen === 'landing' && (
        <Landing
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          error={error}
          clearError={() => setError('')}
          connecting={connecting}
        />
      )}
      {screen === 'lobby' && (
        <Lobby
          roomCode={roomCode}
          players={players}
          isHost={isHost}
          onStartGame={handleStartGame}
          onLeave={handleLeave}
          error={error}
        />
      )}
      {screen === 'game' && (
        <Game
          roomCode={roomCode}
          playerId={playerId}
          playerName={playerName}
          totalRounds={totalRounds}
        />
      )}
      {screen === 'gameOver' && (
        <GameOver
          scores={scores}
          playerId={playerId}
          isHost={isHost}
          onPlayAgain={handlePlayAgain}
          onLeave={handleLeave}
        />
      )}
      <DebugOverlay />
    </div>
  );
}
