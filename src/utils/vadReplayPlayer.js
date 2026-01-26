/**
 * VAD Replay Player (WebAudio only)
 * - Blob/WAV/ObjectURL 없이 Float32 PCM을 재생
 * - 싱글턴 AudioContext + 단일 source 재사용(중복 재생 방지)
 */
let ctx = null;
let source = null;
let gain = null;

function getCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (ctx) return ctx;
  ctx = new AudioCtx();
  gain = ctx.createGain();
  gain.gain.value = 1.0;
  gain.connect(ctx.destination);
  return ctx;
}

export function stopVadReplay() {
  if (source) {
    try {
      source.onended = null;
      source.stop(0);
    } catch (_) {}
    try {
      source.disconnect();
    } catch (_) {}
    source = null;
  }
}

/**
 * @param {{pcm: Float32Array, sampleRate: number, volume?: number}} params
 */
export async function playVadReplay({ pcm, sampleRate, volume = 1.0 }) {
  if (!pcm || pcm.length <= 0) return;
  const c = getCtx();
  if (!c) return;

  stopVadReplay();

  try {
    if (c.state === 'suspended') await c.resume();
  } catch (_) {}

  const sr = Math.max(8000, Math.min(48000, Number(sampleRate) || 16000));
  const buf = c.createBuffer(1, pcm.length, sr);
  buf.copyToChannel(pcm, 0);

  const s = c.createBufferSource();
  s.buffer = buf;
  s.connect(gain);
  if (gain) gain.gain.value = Math.max(0, Math.min(2.0, volume));

  source = s;
  s.onended = () => {
    if (source === s) {
      try {
        s.disconnect();
      } catch (_) {}
      source = null;
    }
  };
  s.start(0);
}

