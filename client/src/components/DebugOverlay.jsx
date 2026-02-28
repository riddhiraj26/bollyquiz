import { useState, useEffect, useRef } from 'react';
import { subscribe } from '../debugLog';

const CAT_COLORS = {
  socket: '#4fc3f7',
  emit: '#ffb74d',
  recv: '#81c784',
  audio: '#ce93d8',
  error: '#ef5350',
  info: '#90a4ae',
};

export default function DebugOverlay() {
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => subscribe(setEntries), []);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, open]);

  return (
    <div className="fixed top-3 left-3 z-[9999]" style={{ fontFamily: 'monospace', fontSize: 11 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="bg-black/80 text-white px-3 py-1.5 rounded-full border border-white/20
                   text-xs font-bold shadow-lg"
      >
        {open ? 'Close Debug' : 'Debug'}
      </button>

      {open && (
        <div
          className="mt-2 bg-black/90 border border-white/20 rounded-lg shadow-2xl overflow-hidden"
          style={{ width: 340, maxHeight: 320 }}
        >
          <div className="overflow-y-auto p-2" style={{ maxHeight: 320 }}>
            {entries.length === 0 && (
              <div className="text-white/40 text-center py-4">No events yet</div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="flex gap-1.5 leading-tight py-0.5">
                <span className="text-white/40 shrink-0">{e.time}</span>
                <span
                  className="shrink-0 font-bold"
                  style={{ color: CAT_COLORS[e.category] || '#fff', minWidth: 44 }}
                >
                  {e.category}
                </span>
                <span className="text-white/80 break-all">{e.message}</span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>
      )}
    </div>
  );
}
