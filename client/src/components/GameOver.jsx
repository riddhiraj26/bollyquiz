export default function GameOver({ scores, playerId, isHost, onPlayAgain, onLeave }) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const winner = sorted[0];
  const isWinner = winner?.id === playerId;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
      <div className="text-center mb-8 animate-fade-in">
        <div className="text-6xl mb-4">{isWinner ? '🏆' : '🎬'}</div>
        <h1 className="font-display text-3xl sm:text-4xl font-black mb-2">
          {isWinner ? (
            <span className="text-gold">You won!</span>
          ) : (
            <>
              <span className="text-saffron">{winner?.name}</span>
              <span className="text-white/70"> wins!</span>
            </>
          )}
        </h1>
        <p className="text-white/40">Final Standings</p>
      </div>

      <div className="w-full max-w-sm space-y-2 mb-8">
        {sorted.map((player, i) => {
          const isMe = player.id === playerId;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all
                ${i === 0
                  ? 'bg-gradient-to-r from-gold/20 to-saffron/20 border border-gold/30 scale-105'
                  : isMe
                    ? 'bg-saffron/10 border border-saffron/20'
                    : 'bg-white/5 border border-white/5'
                }`}
            >
              <span className="w-8 text-center text-lg">
                {medal || <span className="text-white/30 text-sm">{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-display font-bold truncate ${i === 0 ? 'text-gold' : isMe ? 'text-saffron' : 'text-white/80'}`}>
                  {player.name}
                  {isMe && <span className="text-white/30 text-xs ml-1">(you)</span>}
                </p>
              </div>
              <span className={`font-display font-bold text-lg ${i === 0 ? 'text-gold' : 'text-white/60'}`}>
                {player.score}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        {isHost && (
          <button
            onClick={onPlayAgain}
            className="flex-1 bg-gradient-to-r from-saffron to-magenta text-white font-display
                       font-bold py-3 rounded-xl hover:scale-105 transition-transform"
          >
            Play Again
          </button>
        )}
        <button
          onClick={onLeave}
          className={`${isHost ? 'flex-1' : 'w-full'} bg-card border border-white/10 text-white/70
                     font-display font-bold py-3 rounded-xl hover:bg-card-hover
                     hover:text-white transition-all`}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
