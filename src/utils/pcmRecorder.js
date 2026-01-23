/**
 * MediaStream을 PCM(Float32)로 캡처해서 WAV로 반환하는 간단 레코더.
 * - Safari에서 MediaRecorder(webm/ogg) 재생/디코딩이 막히는 이슈 우회용
 * - 성능/호환을 위해 ScriptProcessorNode 사용 (deprecated지만 광범위 동작)
 */
export function createPcmRecorder(stream, { channelCount = 1 } = {}) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const source = ctx.createMediaStreamSource(stream);

  // 일부 환경에서 input channel mismatch가 날 수 있어 mono로 캡처
  const inCh = 1;
  const outCh = 1;
  const bufferSize = 4096;
  const processor = ctx.createScriptProcessor(bufferSize, inCh, outCh);

  const chunks = [];
  let startedAt = Date.now();
  let stopped = false;

  processor.onaudioprocess = (e) => {
    if (stopped) return;
    const input = e.inputBuffer.getChannelData(0);
    // copy (input은 재사용됨)
    chunks.push(new Float32Array(input));
  };

  // connect chain (must connect to destination for processing in some browsers)
  source.connect(processor);
  processor.connect(ctx.destination);

  async function stop() {
    if (stopped) return null;
    stopped = true;
    try {
      processor.disconnect();
    } catch (_) {}
    try {
      source.disconnect();
    } catch (_) {}
    try {
      await ctx.close();
    } catch (_) {}

    const sampleRate = ctx.sampleRate || 48000;
    const pcm = concatFloat32(chunks);
    return float32ToWavBlob(pcm, sampleRate, channelCount);
  }

  function getDurationMs() {
    return Math.max(0, Date.now() - (startedAt || Date.now()));
  }

  return { stop, getDurationMs };
}

function concatFloat32(chunks) {
  const total = chunks.reduce((sum, a) => sum + (a?.length || 0), 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const a of chunks) {
    if (!a?.length) continue;
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

function float32ToWavBlob(samples, sampleRate, numberOfChannels = 1) {
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  // mono only currently
  const interleaved = samples instanceof Float32Array ? samples : new Float32Array(samples || []);
  const dataLength = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  floatTo16BitPCM(view, 44, interleaved);
  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

