import { useState, useMemo } from 'react';

const POSTER_COUNT = 12;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

function generatePosterLayout() {
  const rand = seededRandom(42);
  const posters = [];

  const slots = [
    { x: 2, y: 3 },
    { x: 75, y: 5 },
    { x: 15, y: 30 },
    { x: 60, y: 25 },
    { x: 85, y: 38 },
    { x: 5, y: 60 },
    { x: 40, y: 55 },
    { x: 72, y: 62 },
    { x: 25, y: 80 },
    { x: 55, y: 85 },
    { x: 88, y: 78 },
    { x: 0, y: 92 },
  ];

  for (let i = 0; i < POSTER_COUNT; i++) {
    const slot = slots[i];
    const jitterX = (rand() - 0.5) * 8;
    const jitterY = (rand() - 0.5) * 6;
    const sizes = [100, 110, 130, 90, 120, 105, 140, 95, 115, 125, 108, 135];
    const rotations = [-6, 4, -3, 5, -2, 7, -4, 3, -5, 2, -7, 6];

    posters.push({
      id: i + 1,
      x: slot.x + jitterX,
      y: slot.y + jitterY,
      width: sizes[i],
      rotation: rotations[i],
    });
  }

  return posters;
}

const POSTERS = generatePosterLayout();

export default function Landing({ onCreateRoom, onJoinRoom, error, clearError, connecting }) {
  const [createName, setCreateName] = useState('');
  const [joinName, setJoinName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState(null);

  const handleCreate = (e) => {
    e.preventDefault();
    if (createName.trim()) onCreateRoom(createName.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (joinName.trim() && joinCode.trim()) onJoinRoom(joinName.trim(), joinCode.trim());
  };

  return (
    <div className="flex-1 flex items-center justify-center relative overflow-hidden">
      {/* Scattered poster background */}
      <div className="absolute inset-0 pointer-events-none">
        {POSTERS.map((p) => (
          <img
            key={p.id}
            src={`/posters/${p.id}.jpg`}
            alt=""
            loading="lazy"
            className="absolute rounded-md shadow-lg shadow-black/30"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.width}px`,
              opacity: 0.12,
              transform: `rotate(${p.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center px-4 py-8 w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl sm:text-7xl font-black tracking-tight mb-2">
            <span className="text-saffron">Bolly</span>
            <span className="text-gold">Quiz</span>
          </h1>
          <p className="text-white/60 text-lg font-body">
            Guess the Bollywood movie from the song!
          </p>
          <div className="mt-3 flex items-center justify-center gap-2 text-2xl">
            <span>🎬</span>
            <span>🎵</span>
            <span>🏆</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl text-sm w-full text-center">
            {error}
            <button onClick={clearError} className="ml-2 text-red-300 hover:text-white font-bold">
              ✕
            </button>
          </div>
        )}

        {!mode && (
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <button
              onClick={() => setMode('create')}
              className="flex-1 bg-saffron text-white font-display font-bold text-lg py-4 px-6
                         rounded-2xl hover:scale-105 transition-transform shadow-lg shadow-saffron/25"
            >
              Create Game
            </button>
            <button
              onClick={() => setMode('join')}
              className="flex-1 bg-card border border-white/10 text-white font-display font-bold
                         text-lg py-4 px-6 rounded-2xl hover:bg-card-hover hover:scale-105
                         transition-all"
            >
              Join Game
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="w-full space-y-4">
            <div className="bg-deep-purple/90 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-display font-bold text-xl text-center">Create a Game</h2>
              <input
                type="text"
                placeholder="Your name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder:text-white/30 focus:outline-none focus:ring-2
                           focus:ring-saffron/50 focus:border-saffron/50 text-center text-lg"
              />
              <button
                type="submit"
                disabled={!createName.trim() || connecting}
                className="w-full bg-saffron text-white font-display font-bold py-3 rounded-xl
                           hover:scale-105 transition-transform disabled:opacity-40
                           disabled:hover:scale-100"
              >
                {connecting ? 'Connecting…' : "Let's Go!"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} className="w-full space-y-4">
            <div className="bg-deep-purple/90 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-display font-bold text-xl text-center">Join a Game</h2>
              <input
                type="text"
                placeholder="Your name"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                maxLength={20}
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder:text-white/30 focus:outline-none focus:ring-2
                           focus:ring-saffron/50 focus:border-saffron/50 text-center text-lg"
              />
              <input
                type="text"
                placeholder="Room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                           text-white placeholder:text-white/30 focus:outline-none focus:ring-2
                           focus:ring-gold/50 focus:border-gold/50 text-center text-2xl
                           font-display font-bold tracking-[0.3em] uppercase"
              />
              <button
                type="submit"
                disabled={!joinName.trim() || joinCode.trim().length < 4 || connecting}
                className="w-full bg-saffron text-white font-display font-bold py-3 rounded-xl
                           hover:scale-105 transition-transform disabled:opacity-40
                           disabled:hover:scale-100"
              >
                {connecting ? 'Connecting…' : 'Join Room'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="w-full text-white/40 hover:text-white/70 text-sm transition-colors"
            >
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
