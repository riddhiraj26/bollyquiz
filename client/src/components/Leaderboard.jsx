export default function Leaderboard({ scores, playerId }) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  if (sorted.length === 0) return null;

  return (
    <div className="lg:w-72 bg-white/5 border-t lg:border-t-0 lg:border-l border-white/10 p-4">
      <h3 className="font-display font-bold text-sm text-white/50 uppercase tracking-wider mb-3">
        Leaderboard
      </h3>
      <div className="space-y-2">
        {sorted.map((player, i) => {
          const isMe = player.id === playerId;
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
          return (
            <div
              key={player.id}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-colors
                ${isMe ? 'bg-saffron/15 border border-saffron/30' : 'bg-white/5'}`}
            >
              <span className="w-6 text-center text-sm">
                {medal || <span className="text-white/30">{i + 1}</span>}
              </span>
              <span className={`flex-1 truncate text-sm font-medium ${isMe ? 'text-gold' : 'text-white/80'}`}>
                {player.name}
                {isMe && <span className="text-white/30 text-xs ml-1">(you)</span>}
              </span>
              <span className={`font-display font-bold text-sm ${isMe ? 'text-gold' : 'text-white/60'}`}>
                {player.score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
