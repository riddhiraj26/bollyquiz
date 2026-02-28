import { useState, useEffect, useCallback } from 'react';
import socket from './socket';
import { unlockAudio } from './audioUnlock';
import Landing from './components/Landing';
import Lobby from './components/Lobby';
import Game from './components/Game';
import GameOver from './components/GameOver';

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

  useEffect(() => {
    socket.connect();

    socket.on('room_joined', (data) => {
      setRoomCode(data.roomCode);
      setPlayerId(data.playerId);
      setIsHost(data.isHost);
      setPlayers(data.players);
      setError('');
      setScreen('lobby');
    });

    socket.on('player_joined', (data) => {
      setPlayers(data.players);
    });

    socket.on('game_started', (data) => {
      setTotalRounds(data.totalRounds);
      setScreen('game');
    });

    socket.on('game_over', (data) => {
      setScores(data.finalScores);
      setScreen('gameOver');
    });

    socket.on('back_to_lobby', (data) => {
      setPlayers(data.players);
      setScores([]);
      setScreen('lobby');
    });

    socket.on('error', (data) => {
      setError(data.message);
      if (data.message === 'Host disconnected — game ended') {
        setScreen('landing');
        setRoomCode('');
        setPlayers([]);
      }
    });

    return () => {
      socket.off('room_joined');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('game_over');
      socket.off('back_to_lobby');
      socket.off('error');
      socket.disconnect();
    };
  }, []);

  const handleCreateRoom = useCallback((name) => {
    unlockAudio();
    setPlayerName(name);
    socket.emit('join_room', { playerName: name });
  }, []);

  const handleJoinRoom = useCallback((name, code) => {
    unlockAudio();
    setPlayerName(name);
    socket.emit('join_room', { roomCode: code, playerName: name });
  }, []);

  const handleStartGame = useCallback(() => {
    unlockAudio();
    socket.emit('start_game', { roomCode });
  }, [roomCode]);

  const handleLeave = useCallback(() => {
    socket.disconnect();
    socket.connect();
    setScreen('landing');
    setRoomCode('');
    setPlayers([]);
    setScores([]);
    setError('');
  }, []);

  const handlePlayAgain = useCallback(() => {
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
    </div>
  );
}
