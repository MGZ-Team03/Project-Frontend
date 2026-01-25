/**
 * VAD 구간만 추출한 오디오 생성
 * @param {Blob} audioBlob - 원본 오디오 Blob
 * @param {Array<{start: number, end: number}>} segments - VAD 구간 (밀리초)
 * @returns {Promise<Blob>} - 트리밍된 오디오 Blob
 */
export async function extractVADSegments(audioBlob, segments) {
  if (!segments || segments.length === 0) {
    return audioBlob; // VAD 구간이 없으면 원본 반환
  }

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // Blob을 ArrayBuffer로 변환
    const arrayBuffer = await audioBlob.arrayBuffer();

    // 오디오 디코딩
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const maxMs = Math.max(0, Math.floor((audioBuffer.duration || 0) * 1000));

    const normalized = normalizeSegments(segments, { maxMs, padMs: 80, mergeGapMs: 80, minDurationMs: 40 });
    if (!normalized.length) return audioBlob;

    // VAD 구간의 총 길이 계산 (초)
    const totalDuration = normalized.reduce((sum, seg) => sum + (seg.end - seg.start), 0) / 1000;
    const totalSamples = Math.max(1, Math.floor(totalDuration * sampleRate));

    // 새 오디오 버퍼 생성
    const newBuffer = audioContext.createBuffer(numberOfChannels, totalSamples, sampleRate);

    let outputOffset = 0;

    // 각 VAD 구간을 복사 (빠른 subarray+set 사용)
    for (const segment of normalized) {
      const startSample = Math.floor((segment.start / 1000) * sampleRate);
      const endSample = Math.floor((segment.end / 1000) * sampleRate);
      const segmentLength = Math.max(0, endSample - startSample);
      if (segmentLength <= 0) continue;

      let copyLen = 0;
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const inputData = audioBuffer.getChannelData(channel);
        const outputData = newBuffer.getChannelData(channel);

        const srcStart = Math.max(0, Math.min(inputData.length, startSample));
        const srcEnd = Math.max(srcStart, Math.min(inputData.length, endSample));
        copyLen = Math.min(segmentLength, outputData.length - outputOffset, srcEnd - srcStart);
        if (copyLen <= 0) continue;

        outputData.set(inputData.subarray(srcStart, srcStart + copyLen), outputOffset);
      }

      outputOffset += copyLen;
      if (outputOffset >= totalSamples) break;
    }

    // AudioBuffer를 Blob으로 변환
    const wavBlob = await audioBufferToWav(newBuffer);
    return wavBlob;
  } catch (e) {
    // 디코딩/변환 실패 시, 원본 그대로 반환 (재생이라도 가능하게)
    console.warn('[audioTrimmer] extractVADSegments failed:', e);
    return audioBlob;
  } finally {
    try {
      await audioContext.close();
    } catch (_) {}
  }
}

/**
 * MediaRecorder 등으로 얻은 오디오 Blob을 브라우저 호환 좋은 WAV로 변환
 * @param {Blob} audioBlob
 * @returns {Promise<Blob>} WAV Blob
 */
export async function convertAudioBlobToWav(audioBlob) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return await audioBufferToWav(audioBuffer);
  } finally {
    try {
      await audioContext.close();
    } catch (_) {}
  }
}

function normalizeSegments(segments, { maxMs, padMs = 0, mergeGapMs = 0, minDurationMs = 0 } = {}) {
  const maxT = typeof maxMs === 'number' && Number.isFinite(maxMs) ? Math.max(0, maxMs) : null;
  const pad = Math.max(0, padMs | 0);
  const gap = Math.max(0, mergeGapMs | 0);
  const minDur = Math.max(0, minDurationMs | 0);

  const cleaned = (Array.isArray(segments) ? segments : [])
    .map((s) => ({
      start: Number.isFinite(s?.start) ? s.start : null,
      end: Number.isFinite(s?.end) ? s.end : null,
    }))
    .filter((s) => s.start !== null && s.end !== null)
    .map((s) => {
      let start = Math.max(0, s.start - pad);
      let end = Math.max(start, s.end + pad);
      if (maxT !== null) {
        start = Math.min(start, maxT);
        end = Math.min(end, maxT);
      }
      return { start, end };
    })
    .filter((s) => s.end - s.start >= minDur)
    .sort((a, b) => a.start - b.start);

  if (!cleaned.length) return [];

  const merged = [];
  for (const seg of cleaned) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ ...seg });
      continue;
    }
    // gap 이하면 하나로 합치기
    if (seg.start <= last.end + gap) {
      last.end = Math.max(last.end, seg.end);
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

/**
 * AudioBuffer를 WAV Blob으로 변환
 */
async function audioBufferToWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;

  const data = [];
  for (let channel = 0; channel < numberOfChannels; channel++) {
    data.push(audioBuffer.getChannelData(channel));
  }

  const interleaved = interleave(data);
  const dataLength = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV 헤더 작성
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

  // PCM 샘플 작성
  floatTo16BitPCM(view, 44, interleaved);

  return new Blob([buffer], { type: 'audio/wav' });
}

function interleave(channelData) {
  const length = channelData[0].length;
  const numberOfChannels = channelData.length;
  const result = new Float32Array(length * numberOfChannels);

  let offset = 0;
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      result[offset++] = channelData[channel][i];
    }
  }

  return result;
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
