import { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import { unlockAudio, getAudioContext } from '../audioUnlock';
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
  const [waitingForPlayer, setWaitingForPlayer] = useState(null);

  const audioBufferRef = useRef(null);  // decoded AudioBuffer ready to play
  const sourceNodeRef = useRef(null);   // currently playing AudioBufferSourceNode
  const playPendingRef = useRef(false); // play_now arrived before buffer was decoded
  const fetchAbortRef = useRef(null);   // AbortController for in-flight fetch
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const readySentRef = useRef(false);
  const prepareReceivedAtRef = useRef(null);

  const cleanupAudio = useCallback(() => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
      fetchAbortRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    audioBufferRef.current = null;
    playPendingRef.current = false;
  }, []);

  // Plays the decoded buffer through the already-unlocked AudioContext.
  // Because it never touches HTMLAudioElement, iOS autoplay policy doesn't apply.
  const startPlayback = useCallback(async () => {
    const buf = audioBufferRef.current;
    if (!buf) {
      dlog('error', 'startPlayback: buffer not ready');
      return;
    }
    try {
      const audioCtx = getAudioContext();
      dlog('audio', `ctx.state=${audioCtx.state}`);
      if (audioCtx.state !== 'running') {
        await audioCtx.resume();
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buf;
      source.connect(audioCtx.destination);
      source.start(0);
      sourceNodeRef.current = source;
      dlog('audio', 'AudioBufferSource started ✓');
      setNeedsTap(false);
    } catch (err) {
      dlog('error', `AudioBufferSource failed: ${err.message}`);
      setNeedsTap(true);
    }
  }, []);

  useEffect(() => {
    const handlePrepareRound = ({ roundNumber: rn, previewUrl }) => {
      const now = Date.now();
      prepareReceivedAtRef.current = now;
      dlog('recv', `prepare_round #${rn} url=...${previewUrl.slice(-12)}`);

      setRoundNumber(rn);
      setAnswer('');
      setPhase('loading');
      setRoundResult(null);
      setNeedsTap(false);
      setWaitingForPlayer(null);

      cleanupAudio();
      readySentRef.current = false;

      dlog('audio', 'unlockAudio() called');
      unlockAudio();

      const sendReady = () => {
        if (readySentRef.current) return;
        readySentRef.current = true;
        const elapsed = Date.now() - prepareReceivedAtRef.current;
        dlog('emit', `round_ready (preload took ${elapsed}ms)`);
        socket.emit('round_ready', { roomCode });
      };

      // Fetch the audio file and decode it via the Web Audio API.
      // This bypasses HTMLAudioElement entirely, so iOS autoplay policy never fires.
      const abortCtrl = new AbortController();
      fetchAbortRef.current = abortCtrl;

      dlog('audio', 'fetching audio...');
      fetch(previewUrl, { signal: abortCtrl.signal })
        .then(res => res.arrayBuffer())
        .then(arrayBuf => {
          if (abortCtrl.signal.aborted) return null;
          return getAudioContext().decodeAudioData(arrayBuf);
        })
        .then(audioBuf => {
          if (!audioBuf || abortCtrl.signal.aborted) return;
          audioBufferRef.current = audioBuf;
          const elapsed = Date.now() - prepareReceivedAtRef.current;
          dlog('audio', `decoded (${elapsed}ms, ${audioBuf.duration.toFixed(1)}s)`);
          sendReady();
          // If play_now already arrived while we were still loading, play immediately.
          if (playPendingRef.current) {
            playPendingRef.current = false;
            startPlayback();
          }
        })
        .catch(err => {
          if (err.name === 'AbortError') return;
          dlog('error', `audio fetch/decode failed: ${err.message}`);
          // Signal ready anyway so the game isn't permanently blocked.
          sendReady();
        });
    };

    const handlePlayNow = () => {
      const sincePrepare = prepareReceivedAtRef.current
        ? Date.now() - prepareReceivedAtRef.current
        : '?';
      dlog('recv', `play_now (${sincePrepare}ms since prepare)`);

      setPhase('playing');
      setTimeLeft(30);
      setNeedsTap(false);

      if (audioBufferRef.current) {
        startPlayback();
      } else {
        // Still fetching/decoding — startPlayback() will fire when ready.
        dlog('audio', 'buffer not ready yet — will play when decoded');
        playPendingRef.current = true;
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

    const handleWaitingForPlayer = ({ playerName: name }) => {
      dlog('recv', `waiting_for_player: ${name}`);
      setWaitingForPlayer(name);
    };

    const handlePlayerRejoined = ({ playerName: name }) => {
      dlog('recv', `player_rejoined: ${name}`);
      setWaitingForPlayer(null);
    };

    socket.on('prepare_round', handlePrepareRound);
    socket.on('play_now', handlePlayNow);
    socket.on('round_won', handleRoundWon);
    socket.on('round_timeout', handleRoundTimeout);
    socket.on('waiting_for_player', handleWaitingForPlayer);
    socket.on('player_rejoined', handlePlayerRejoined);

    return () => {
      socket.off('prepare_round', handlePrepareRound);
      socket.off('play_now', handlePlayNow);
      socket.off('round_won', handleRoundWon);
      socket.off('round_timeout', handleRoundTimeout);
      socket.off('waiting_for_player', handleWaitingForPlayer);
      socket.off('player_rejoined', handlePlayerRejoined);
      cleanupAudio();
      clearInterval(timerRef.current);
    };
  }, [cleanupAudio, startPlayback, roomCode]);

  const handleTapToPlay = () => {
    dlog('audio', 'user tapped to play');
    unlockAudio();
    startPlayback();
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

              {waitingForPlayer && (
                <div className="flex items-center justify-center gap-2 text-white/40 text-sm mt-2">
                  <div className="w-3 h-3 border border-white/30 border-t-white/60 rounded-full animate-spin" />
                  <span>Waiting for {waitingForPlayer} to reconnect...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Leaderboard scores={scores} playerId={playerId} />
    </div>
  );
}
