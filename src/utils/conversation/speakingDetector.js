import { calculateMAR } from './marCalculator';
import { CONFIG } from '../../config/speakingConfig';

/**
 * 발음 감지 로직
 * 입이 열림 (MAR > threshold) AND 음성 감지 (volume > 동적 임계값)
 * 두 조건을 모두 만족할 때만 발음 중으로 판단
 *
 * 동적 임계값: 배경 소음 레벨(noiseFloor)을 실시간 추적하여
 * 그 위로 VOICE_OFFSET 이상 올라갈 때만 음성으로 판정
 *
 * @param {Array} landmarks - MediaPipe 얼굴 랜드마크
 * @param {number} audioVolume - 현재 오디오 볼륨 (0~255)
 * @returns {boolean} 발음 중 여부
 */

// 배경 소음 레벨 추적 (동적 노이즈 플로어)
let noiseFloor = 0;

// MAR 히스토리(입 움직임 감지용)
let marHistory = [];

function pushMAR(mar) {
  const windowSize = CONFIG.MAR_STD_WINDOW || 8;
  marHistory.push(mar);
  if (marHistory.length > windowSize) {
    marHistory = marHistory.slice(marHistory.length - windowSize);
  }
}

function stddev(values) {
  if (!values || values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * 노이즈 플로어 업데이트
 * - 입이 열려있으면(mouthOpen): 발음 중일 확률이 높으므로 업데이트 중지 (Freeze)
 * - 볼륨이 현재 노이즈 플로어보다 낮으면: 즉시 업데이트 (빠르게 적응)
 * - 볼륨이 높으면: 천천히 decay (음성 중에는 노이즈 플로어가 올라가지 않도록)
 */
function updateNoiseFloor(volume, mouthActive) {
  // 입이 활성(열림/움직임)이면 말하는 중일 가능성이 높으므로 배경 소음 기준값을 올리지 않음
  if (mouthActive) {
    return;
  }

  // 현재 기준으로 '말소리'라고 볼 수 있는 임계값
  const voiceThreshold = noiseFloor + CONFIG.VOICE_OFFSET;

  if (volume < noiseFloor || noiseFloor === 0) {
    // 더 낮은 볼륨 감지 시 빠르게 적응 (배경 소음 레벨 하강 추적)
    noiseFloor = volume;
  } else if (volume > voiceThreshold) {
    // 말소리로 추정되면(임계값 초과), 노이즈 플로어를 업데이트하지 않음 (Hold)
    // 소음이 아니라 음성이므로 배경 소음 레벨에 반영하면 안 됨
  } else {
    // 천천히 현재 볼륨 방향으로 이동 (decay)
    noiseFloor = noiseFloor * CONFIG.NOISE_FLOOR_DECAY + volume * (1 - CONFIG.NOISE_FLOOR_DECAY);
  }
}

/**
 * 현재 노이즈 플로어 값 반환 (디버깅용)
 */
export function getNoiseFloor() {
  return noiseFloor;
}

/**
 * 노이즈 플로어 리셋 (테스트/재시작용)
 */
export function resetNoiseFloor() {
  noiseFloor = 0;
  marHistory = [];
}

/**
 * 발음 상태 상세 정보 반환
 */
export function getSpeakingState(landmarks, audioVolume) {
  // landmarks가 없으면 발음 중이 아님
  if (!landmarks || landmarks.length === 0) {
    return {
      isSpeaking: false,
      mouthOpen: false,
      mouthMoving: false,
      mouthActive: false,
      hasAudio: false,
      mar: 0,
      marStd: 0,
      volume: audioVolume,
      threshold: 0
    };
  }

  const mar = calculateMAR(landmarks);
  const mouthOpen = mar > CONFIG.MAR_THRESHOLD;

  // MAR 변화량(표준편차) 기반 입 움직임 감지
  pushMAR(mar);
  const marStd = stddev(marHistory);
  const mouthMoving = marStd > (CONFIG.MAR_STD_THRESHOLD || 0);
  const mouthActive = mouthOpen || mouthMoving;

  // 노이즈 플로어 업데이트 (입이 활성(열림/움직임)이면 업데이트 스킵)
  updateNoiseFloor(audioVolume, mouthActive);

  // 동적 임계값: noiseFloor + VOICE_OFFSET, 최소 AUDIO_THRESHOLD
  const dynamicThreshold = Math.max(
    noiseFloor + CONFIG.VOICE_OFFSET,
    CONFIG.AUDIO_THRESHOLD
  );
  const hasAudio = audioVolume > dynamicThreshold;

  // 디버깅용 로그 (개발 중에만 사용)
  if (import.meta.env.DEV) {
    if (mouthActive || hasAudio || audioVolume > 1) {
      console.log(
        `[Speaking Detector] MAR: ${mar.toFixed(3)}, MARstd: ${marStd.toFixed(4)}, MouthOpen: ${mouthOpen}, MouthMove: ${mouthMoving}, Vol: ${audioVolume.toFixed(1)}, NoiseFloor: ${noiseFloor.toFixed(1)}, Thr: ${dynamicThreshold.toFixed(1)}, Speaking: ${(mouthActive && hasAudio)}`
      );
    }
  }

  return {
    isSpeaking: mouthActive && hasAudio,
    mouthOpen,
    mouthMoving,
    mouthActive,
    hasAudio,
    mar,
    marStd,
    volume: audioVolume,
    threshold: dynamicThreshold
  };
}

export function isSpeaking(landmarks, audioVolume) {
  return getSpeakingState(landmarks, audioVolume).isSpeaking;
}
