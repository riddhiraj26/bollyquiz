import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import { unlockAudio } from '../audioUnlock';
import { dlog } from '../debugLog';
import Leaderboard from './Leaderboard';

export default function Game({ roomCode, playerId, playerName, totalRounds }) {
  const [roundNumber, setRoundNumber] = useState(0);
  const [answer, setAnswer] = useState('');
  const [scores, setScores] = useState([]);
  const [phase, setPhase] = useState('waiting');
  const [roundResult, setRoundResult] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [needsTap, setNeedsTap] = useState(false);

  const audioRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const readySentRef = useRef(false);
  const prepareTimeoutRef = useRef(null);
  const prepareReceivedAtRef = useRef(null);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handlePrepareRound = ({ roundNumber: rn, previewUrl, totalRounds: tr }) => {
      const now = Date.now();
      prepareReceivedAtRef.current = now;
      dlog('recv', `prepare_round #${rn} url=...${previewUrl.slice(-12)}`);

      setRoundNumber(rn);
      setAnswer('');
      setPhase('loading');
      setRoundResult(null);
      setNeedsTap(false);

      cleanupAudio();
      readySentRef.current = false;

      dlog('audio', 'unlockAudio() called');
      unlockAudio();

      const audio = new Audio(previewUrl);
      audio.preload = 'auto';
      audioRef.current = audio;

      dlog('audio', 'preloading started...');

      const sendReady = () => {
        if (readySentRef.current) return;
        readySentRef.current = true;
        const elapsed = Date.now() - prepareReceivedAtRef.current;
        dlog('emit', `round_ready (preload took ${elapsed}ms)`);
        socket.emit('round_ready', { roomCode });
      };

      audio.addEventListener('canplaythrough', () => {
        const elapsed = Date.now() - prepareReceivedAtRef.current;
        dlog('audio', `canplaythrough fired (${elapsed}ms)`);
        sendReady();
      }, { once: true });

      audio.addEventListener('error', (e) => {
        dlog('error', `audio load error: ${e.target?.error?.message || 'unknown'}`);
        sendReady();
      }, { once: true });

      clearTimeout(prepareTimeoutRef.current);
      prepareTimeoutRef.current = setTimeout(() => {
        dlog('audio', 'preload timeout (4.5s), sending ready anyway');
        sendReady();
      }, 4500);
    };

    const handlePlayNow = () => {
      const sincePrepare = prepareReceivedAtRef.current
        ? Date.now() - prepareReceivedAtRef.current
        : '?';
      dlog('recv', `play_now (${sincePrepare}ms since prepare)`);

      setPhase('playing');
      setTimeLeft(30);
      setNeedsTap(false);

      const audio = audioRef.current;
      if (audio) {
        dlog('audio', 'calling audio.play()...');
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.then(() => {
            dlog('audio', 'play() SUCCESS');
          }).catch((err) => {
            dlog('error', `play() REJECTED: ${err.message}`);
            setNeedsTap(true);
          });
        }
      } else {
        dlog('error', 'play_now but audioRef is null!');
      }

      const playStart = Date.now();
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - playStart) / 1000;
        const remaining = Math.max(0, 30 - elapsed);
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(timerRef.current);
      }, 100);

      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleRoundWon = (data) => {
      dlog('recv', `round_won winner=${data.winnerName} answer="${data.correctAnswer}"`);
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
      setNeedsTap(false);
    };

    const handleRoundTimeout = (data) => {
      dlog('recv', `round_timeout answer="${data.correctAnswer}"`);
      setPhase('result');
      setRoundResult({
        type: 'timeout',
        correctAnswer: data.correctAnswer,
      });
      setScores(data.scores);
      cleanupAudio();
      clearInterval(timerRef.current);
      setNeedsTap(false);
    };

    socket.on('prepare_round', handlePrepareRound);
    socket.on('play_now', handlePlayNow);
    socket.on('round_won', handleRoundWon);
    socket.on('round_timeout', handleRoundTimeout);

    return () => {
      socket.off('prepare_round', handlePrepareRound);
      socket.off('play_now', handlePlayNow);
      socket.off('round_won', handleRoundWon);
      socket.off('round_timeout', handleRoundTimeout);
      cleanupAudio();
      clearInterval(timerRef.current);
      clearTimeout(prepareTimeoutRef.current);
    };
  }, [cleanupAudio, roomCode]);

  const handleTapToPlay = () => {
    dlog('audio', 'user tapped to play');
    unlockAudio();
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        dlog('audio', 'tap play() SUCCESS');
      }).catch((err) => {
        dlog('error', `tap play() REJECTED: ${err.message}`);
      });
    }
    setNeedsTap(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!answer.trim() || phase !== 'playing') return;
    dlog('emit', `submit_answer "${answer.trim()}"`);
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
          <div className="text-center">
            <p className="text-white/40 text-sm font-display">
              Round {roundNumber} of {totalRounds}
            </p>
          </div>

          {phase === 'playing' && (
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${timerColor} rounded-full transition-all duration-100 ease-linear`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
          )}

          {phase === 'waiting' && (
            <div className="text-center py-12">
              <div className="inline-block animate-pulse">
                <span className="text-4xl">🎵</span>
              </div>
              <p className="text-white/50 mt-4 font-display">Get ready...</p>
            </div>
          )}

          {phase === 'loading' && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-saffron/60 border-t-saffron rounded-full animate-spin" />
                <span className="text-white/50 font-display">Loading song...</span>
              </div>
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

              {needsTap && (
                <button
                  onClick={handleTapToPlay}
                  className="w-full bg-saffron/20 border border-saffron/50 text-saffron font-display
                             font-bold py-3 rounded-xl hover:bg-saffron/30 transition-colors animate-pulse"
                >
                  Tap to hear the song
                </button>
              )}

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

      <Leaderboard scores={scores} playerId={playerId} />
    </div>
  );
}
