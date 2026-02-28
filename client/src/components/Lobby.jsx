import { useState } from 'react';

export default function Lobby({ roomCode, players, isHost, onStartGame, onLeave, error }) {
  const [copied, setCopied] = useState(false);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <h1 className="font-display text-3xl font-bold mb-8">
        <span className="text-saffron">Bolly</span>
        <span className="text-gold">Quiz</span>
      </h1>

      <div className="bg-card border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-6">
        <div className="text-center">
          <p className="text-white/50 text-sm mb-2">Room Code</p>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border
                       border-white/20 rounded-xl px-6 py-3 transition-colors group"
          >
            <span className="font-display text-3xl font-black tracking-[0.3em] text-gold">
              {roomCode}
            </span>
            <span className="text-white/40 group-hover:text-white/70 text-sm transition-colors">
              {copied ? '✓' : '📋'}
            </span>
          </button>
          <p className="text-white/30 text-xs mt-2">
            {copied ? 'Copied!' : 'Tap to copy'}
          </p>
        </div>

        <div>
          <p className="text-white/50 text-sm mb-3">
            Players ({players.length})
          </p>
          <div className="space-y-2">
            {players.map((player, i) => (
              <div
                key={player.id}
                className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-saffron to-magenta
                                flex items-center justify-center text-sm font-bold shrink-0">
                  {player.name[0].toUpperCase()}
                </div>
                <span className="font-medium truncate">{player.name}</span>
                {i === 0 && (
                  <span className="ml-auto text-xs bg-gold/20 text-gold px-2 py-0.5 rounded-full">
                    Host
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}

        {isHost ? (
          <button
            onClick={onStartGame}
            className="w-full bg-gradient-to-r from-saffron to-magenta text-white font-display
                       font-bold py-3 rounded-xl hover:scale-105 transition-transform
                       shadow-lg shadow-saffron/25"
          >
            Start Game 🎬
          </button>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 text-white/40">
              <span className="inline-block w-2 h-2 bg-saffron rounded-full animate-pulse" />
              Waiting for host to start...
            </div>
          </div>
        )}

        <button
          onClick={onLeave}
          className="w-full text-white/30 hover:text-white/60 text-sm transition-colors"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
