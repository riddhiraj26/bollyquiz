import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import Leaderboard from './Leaderboard';

export default function Game({ roomCode, playerId, playerName, totalRounds }) {
  const [roundNumber, setRoundNumber] = useState(0);
  const [answer, setAnswer] = useState('');
  const [scores, setScores] = useState([]);
  const [phase, setPhase] = useState('waiting');
  const [roundResult, setRoundResult] = useState(null);
  const [timerStart, setTimerStart] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);

  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleRoundStart = ({ roundNumber: rn, previewUrl, startAt, totalRounds: tr }) => {
      setRoundNumber(rn);
      setAnswer('');
      setPhase('playing');
      setRoundResult(null);

      cleanupAudio();
      const audio = new Audio(previewUrl);
      audioRef.current = audio;

      const delay = Math.max(0, startAt - Date.now());
      const playTimeout = setTimeout(() => {
        audio.play().catch(() => {});
      }, delay);

      const roundStartTime = startAt;
      setTimerStart(roundStartTime);
      setTimeLeft(30);

      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - roundStartTime) / 1000;
        const remaining = Math.max(0, 30 - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(timerRef.current);
      }, 100);

      setTimeout(() => inputRef.current?.focus(), delay + 100);

      return () => clearTimeout(playTimeout);
    };

    const handleRoundWon = (data) => {
      setPhase('result');
      setRoundResult({
        type: 'won',
        winnerName: data.winnerName,
        winnerId: data.winnerId,
        correctAnswer: data.correctAnswer,
        pointsAwarded: data.pointsAwarded,
      });
      setScores(data.scores);
      cleanupAudio();
      clearInterval(timerRef.current);
    };

    const handleRoundTimeout = (data) => {
      setPhase('result');
      setRoundResult({
        type: 'timeout',
        correctAnswer: data.correctAnswer,
      });
      setScores(data.scores);
      cleanupAudio();
      clearInterval(timerRef.current);
    };

    socket.on('round_start', handleRoundStart);
    socket.on('round_won', handleRoundWon);
    socket.on('round_timeout', handleRoundTimeout);

    return () => {
      socket.off('round_start', handleRoundStart);
      socket.off('round_won', handleRoundWon);
      socket.off('round_timeout', handleRoundTimeout);
      cleanupAudio();
      clearInterval(timerRef.current);
    };
  }, [cleanupAudio]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim() || phase !== 'playing') return;
    socket.emit('submit_answer', {
      roomCode,
      answer: answer.trim(),
      timestamp: Date.now(),
    });
    setAnswer('');
  };

  const timerPercent = (timeLeft / 30) * 100;
  const timerColor =
    timeLeft > 20 ? 'from-green-400 to-emerald-500' :
    timeLeft > 10 ? 'from-yellow-400 to-amber-500' :
    'from-red-400 to-rose-600';

  return (
    <div className="flex-1 flex flex-col lg:flex-row min-h-screen">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Round info */}
          <div className="text-center">
            <p className="text-white/40 text-sm font-display">
              Round {roundNumber} of {totalRounds}
            </p>
          </div>

          {/* Timer bar */}
          {phase === 'playing' && (
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${timerColor} rounded-full transition-all duration-100 ease-linear`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          )}

          {/* Main content area */}
          {phase === 'waiting' && (
            <div className="text-center py-12">
              <div className="inline-block animate-pulse">
                <span className="text-4xl">🎵</span>
              </div>
              <p className="text-white/50 mt-4 font-display">Get ready...</p>
            </div>
          )}

          {phase === 'playing' && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-3 bg-card rounded-full px-6 py-3 border border-white/10">
                  <span className="text-xl animate-bounce">🎵</span>
                  <span className="text-white/70 font-medium">Song playing...</span>
                  <span className="text-sm text-white/40">{Math.ceil(timeLeft)}s</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Which movie is this song from?"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  autoFocus
                  className="w-full bg-white/10 border-2 border-saffron/50 rounded-2xl px-6 py-4
                             text-white text-xl text-center placeholder:text-white/25
                             focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/30
                             font-body transition-all"
                />
                <button
                  type="submit"
                  disabled={!answer.trim()}
                  className="w-full bg-gradient-to-r from-saffron to-magenta text-white font-display
                             font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform
                             disabled:opacity-30 disabled:hover:scale-100"
                >
                  Submit Answer
                </button>
              </form>
            </div>
          )}

          {phase === 'result' && roundResult && (
            <div className="text-center py-8 space-y-4 animate-fade-in">
              {roundResult.type === 'won' ? (
                <>
                  <div className="text-5xl mb-2">
                    {roundResult.winnerId === playerId ? '🎉' : '👏'}
                  </div>
                  <h2 className="font-display text-2xl font-bold">
                    {roundResult.winnerId === playerId ? (
                      <span className="text-gold">You got it!</span>
                    ) : (
                      <>
                        <span className="text-saffron">{roundResult.winnerName}</span>
                        <span className="text-white/70"> got it!</span>
                      </>
                    )}
                  </h2>
                  {roundResult.winnerId === playerId && (
                    <p className="text-gold/80 font-display font-bold text-lg">
                      +{roundResult.pointsAwarded} pts
                    </p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-5xl mb-2">⏰</div>
                  <h2 className="font-display text-2xl font-bold text-white/70">
                    Time's up!
                  </h2>
                </>
              )}
              <div className="bg-card border border-white/10 rounded-xl px-6 py-4 inline-block">
                <p className="text-white/40 text-xs mb-1">The answer was</p>
                <p className="font-display font-bold text-xl text-gold">
                  {roundResult.correctAnswer}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard sidebar */}
      <Leaderboard scores={scores} playerId={playerId} />
    </div>
  );
}
