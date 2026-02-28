let unlocked = false;

export function unlockAudio() {
  if (unlocked) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    ctx.resume();
    unlocked = true;
  } catch {
    // AudioContext not supported
  }
}
