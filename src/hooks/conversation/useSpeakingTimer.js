import { useEffect, useState, useRef, useCallback } from 'react';
import { getSpeakingState } from '../../utils/conversation/speakingDetector';
import { CONFIG } from '../../config/speakingConfig';

/**
 * 발음 시간 측정 훅
 * 녹음 중 총 시간과 실제 발음 시간을 측정
 *
 * @param {boolean} isRecording - 녹음 중 여부
 * @param {Array} landmarks - MediaPipe 얼굴 랜드마크
 * @param {number} audioVolume - 현재 오디오 볼륨
 * @returns {Object} { totalTime, speakingTime, ratio, resetTimers, currentlySpeaking }
 */
export function useSpeakingTimer(isRecording, landmarks, audioVolume) {
  const [totalTime, setTotalTime] = useState(0);
  const [speakingTime, setSpeakingTime] = useState(0);
  const [currentlySpeaking, setCurrentlySpeaking] = useState(false);

  const lastTickTimeRef = useRef(Date.now());
  const timerIdRef = useRef(null);
  const landmarksRef = useRef(landmarks);
  const audioVolumeRef = useRef(audioVolume);
  const lastMouthOpenTimeRef = useRef(0);

  // landmarks 최신 값 유지
  // - 배열이면 state 기반으로 업데이트
  // - ref 객체면 interval tick에서 landmarks.current를 직접 읽음 (여기서는 ref만 저장)
  const landmarksInputRef = useRef(landmarks);
  useEffect(() => {
    landmarksInputRef.current = landmarks;
    if (landmarks && typeof landmarks === 'object' && 'current' in landmarks) {
      // ref input: do not overwrite landmarksRef here (tick에서 읽음)
      return;
    }
    landmarksRef.current = landmarks;
  }, [landmarks]);

  useEffect(() => {
    audioVolumeRef.current = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    if (!isRecording) {
      // 녹음 중이 아니면 타이머 중지
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
      setCurrentlySpeaking(false);
      return;
    }

    // 녹음 시작 시 초기화
    lastTickTimeRef.current = Date.now();

    // 타이머 시작
    timerIdRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickTimeRef.current;
      lastTickTimeRef.current = now;

      // 총 시간 증가
      setTotalTime(prev => prev + delta);

      // 발음 감지 (상세 상태 가져오기)
      const currentLandmarks =
        landmarksInputRef.current && typeof landmarksInputRef.current === 'object' && 'current' in landmarksInputRef.current
          ? landmarksInputRef.current.current
          : landmarksRef.current;

      const state = getSpeakingState(currentLandmarks, audioVolumeRef.current);
      
      // 입이 열려있으면 타임스탬프 갱신
      if (state.mouthOpen) {
        lastMouthOpenTimeRef.current = Date.now();
      }

      // 발음 인정 조건:
      // 1. 현재 완전한 발음 상태이거나 (입 열림 + 소리)
      // 2. 소리가 나면서 && 최근 500ms 내에 입이 열려있었음 (자음 발음 등 입 닫힘 보정)
      const isSpeakingExtended = state.isSpeaking || 
        (state.hasAudio && (Date.now() - lastMouthOpenTimeRef.current < 500));

      setCurrentlySpeaking(isSpeakingExtended);

      // 발음 중일 때만 발음 시간 증가
      if (isSpeakingExtended) {
        setSpeakingTime(prev => prev + delta);
      }
    }, CONFIG.TIMER_UPDATE_INTERVAL);

    return () => {
      if (timerIdRef.current) {
        clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
  }, [isRecording]); // isRecording만 의존성으로 - 타이머 재시작 방지

  // 발음 비율 계산
  const ratio = totalTime > 0 ? (speakingTime / totalTime) * 100 : 0;

  // 타이머 리셋 함수
  const resetTimers = useCallback(() => {
    setTotalTime(0);
    setSpeakingTime(0);
    setCurrentlySpeaking(false);
    lastTickTimeRef.current = Date.now();
  }, []);

  return {
    totalTime,
    speakingTime,
    ratio,
    currentlySpeaking,
    resetTimers
  };
}
