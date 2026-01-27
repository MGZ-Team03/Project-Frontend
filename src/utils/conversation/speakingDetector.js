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

export function createSpeakingDetector() {
  // 배경 소음 레벨 추적 (동적 노이즈 플로어)
  let noiseFloor = 0;
  // MAR 히스토리(입 움직임 감지용)
  let marHistory = [];
  // MAR 스무딩 버퍼 (이동평균용 - 랜드마크 오류 필터링)
  let marSmoothingBuffer = [];
  const MAR_SMOOTHING_WINDOW = 5;  // 5 프레임 (250ms)

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
   * MAR 이동평균 계산 (급격한 변화 및 랜드마크 오류 필터링)
   * @param {number} rawMAR - 원본 MAR 값
   * @returns {number} 스무딩된 MAR 값
   */
  function smoothMAR(rawMAR) {
    marSmoothingBuffer.push(rawMAR);
    if (marSmoothingBuffer.length > MAR_SMOOTHING_WINDOW) {
      marSmoothingBuffer = marSmoothingBuffer.slice(-MAR_SMOOTHING_WINDOW);
    }

    // 이동평균 계산
    const sum = marSmoothingBuffer.reduce((a, b) => a + b, 0);
    return sum / marSmoothingBuffer.length;
  }

  /**
   * 노이즈 플로어 업데이트
   * - 입이 열려있으면(mouthOpen): 발음 중일 확률이 높으므로 업데이트 중지 (Freeze)
   * - 볼륨이 현재 노이즈 플로어보다 낮으면: 즉시 업데이트 (빠르게 적응)
   * - 볼륨이 높으면: 천천히 decay (음성 중에는 노이즈 플로어가 올라가지 않도록)
   */
  function updateNoiseFloor(volume, mouthActive, gated = false) {
    // 게이팅(TTS 재생 등) 중에는 노이즈 플로어가 오염되지 않도록 업데이트 금지
    if (gated) return;

    // 입이 활성(열림/움직임)이면 말하는 중일 가능성이 높으므로 배경 소음 기준값을 올리지 않음
    if (mouthActive) return;

    // 현재 기준으로 '말소리'라고 볼 수 있는 임계값
    const voiceThreshold = noiseFloor + CONFIG.VOICE_OFFSET;

    if (volume < noiseFloor || noiseFloor === 0) {
      // 더 낮은 볼륨 감지 시 빠르게 적응 (배경 소음 레벨 하강 추적)
      noiseFloor = volume;
    } else if (volume > voiceThreshold) {
      // 말소리로 추정되면(임계값 초과), 노이즈 플로어를 업데이트하지 않음 (Hold)
    } else {
      // 천천히 현재 볼륨 방향으로 이동 (decay)
      noiseFloor = noiseFloor * CONFIG.NOISE_FLOOR_DECAY + volume * (1 - CONFIG.NOISE_FLOOR_DECAY);
    }
  }

  function getNoiseFloor() {
    return noiseFloor;
  }

  function reset() {
    noiseFloor = 0;
    marHistory = [];
    marSmoothingBuffer = [];
  }

  /**
   * 발음 상태 상세 정보 반환
   * @param {Array} landmarks
   * @param {number} audioVolume
   * @param {Object=} options
   * @param {boolean=} options.gated - TTS 재생 등으로 감지/학습을 막아야 할 때
   */
  function getSpeakingState(landmarks, audioVolume, options = {}) {
    const { gated = false } = options;

    // landmarks가 없으면 "카메라 기반" 판정은 불가하지만,
    // "오디오 기반" 감지(hasAudio/VAD)는 계속 동작해야 한다.
    if (!landmarks || landmarks.length === 0) {
      // noiseFloor가 아직 안정화되지 않았을 때(=0) 말소리로 오염되지 않게,
      // 충분히 조용한 구간에서만 초기화/업데이트한다.
      const baseThreshold = CONFIG.AUDIO_THRESHOLD;
      const dynamicThreshold =
        noiseFloor > 0
          ? Math.max(noiseFloor + CONFIG.VOICE_OFFSET, baseThreshold)
          : baseThreshold;
      const hasAudio = !gated && audioVolume > dynamicThreshold;

      // 배경 소음 구간에서만 노이즈 플로어 업데이트 (랜드마크 없음 → mouthActive 판단 불가)
      if (!gated && audioVolume <= baseThreshold) {
        updateNoiseFloor(audioVolume, false, gated);
      }

      return {
        isSpeaking: false,
        mouthOpen: false,
        mouthMoving: false,
        mouthActive: false,
        hasAudio,
        mar: 0,
        marStd: 0,
        volume: audioVolume,
        threshold: dynamicThreshold,
      };
    }

    // 기본 2-Point MAR 계산 (안정적인 중심점 사용)
    const rawMAR = calculateMAR(landmarks);  // Multi-Point 대신 기본 MAR 사용
    const mar = smoothMAR(rawMAR);  // 이동평균 적용 (랜드마크 오류 필터링)
    const mouthOpen = mar > CONFIG.MAR_THRESHOLD;

    // Inner MAR 계산 (속삭임/조용한 발화 감지) - 임시 비활성화
    // const innerMAR = calculateInnerMAR(landmarks);
    // const innerMouthOpen = innerMAR > CONFIG.INNER_MAR_THRESHOLD;

    // 기본 MAR만 사용 (안정성 우선)
    const mouthOpenCombined = mouthOpen;

    // MAR 변화량(표준편차) 기반 입 움직임 감지
    pushMAR(mar);
    const marStd = stddev(marHistory);
    // mouthMoving: MAR 변화가 있고 + 최소 MAR 값 이상일 때만 (카메라 노이즈 필터링)
    const mouthMoving = marStd > (CONFIG.MAR_STD_THRESHOLD || 0) && mar > 0.02;
    const mouthActive = mouthOpenCombined || mouthMoving;

    // 노이즈 플로어 업데이트 (게이팅 중이면 업데이트 금지)
    updateNoiseFloor(audioVolume, mouthActive, gated);

    // 동적 임계값: noiseFloor + VOICE_OFFSET, 최소 AUDIO_THRESHOLD
    const dynamicThreshold = Math.max(
      noiseFloor + CONFIG.VOICE_OFFSET,
      CONFIG.AUDIO_THRESHOLD
    );
    const hasAudio = audioVolume > dynamicThreshold;

    return {
      isSpeaking: !gated && mouthActive && hasAudio,
      mouthOpen,
      innerMouthOpen: false,  // Inner MAR 비활성화됨
      mouthMoving,
      mouthActive,
      hasAudio: !gated && hasAudio,
      mar,
      marStd,
      volume: audioVolume,
      threshold: dynamicThreshold,
    };
  }

  function isSpeaking(landmarks, audioVolume, options) {
    return getSpeakingState(landmarks, audioVolume, options).isSpeaking;
  }

  return {
    getSpeakingState,
    isSpeaking,
    getNoiseFloor,
    reset,
  };
}

// ===== backward-compatible singleton exports =====
const singleton = createSpeakingDetector();

export function getNoiseFloor() {
  return singleton.getNoiseFloor();
}

export function resetNoiseFloor() {
  singleton.reset();
}

export function getSpeakingState(landmarks, audioVolume) {
  return singleton.getSpeakingState(landmarks, audioVolume);
}

export function isSpeaking(landmarks, audioVolume) {
  return singleton.isSpeaking(landmarks, audioVolume);
}
