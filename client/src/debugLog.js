const MAX_ENTRIES = 80;
const entries = [];
let listeners = [];

function ts() {
  const d = new Date();
  return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function dlog(category, message) {
  const entry = { time: ts(), category, message, id: Date.now() + Math.random() };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  listeners.forEach(fn => fn([...entries]));
}

export function subscribe(fn) {
  listeners.push(fn);
  fn([...entries]);
  return () => {
    listeners = listeners.filter(l => l !== fn);
  };
}
