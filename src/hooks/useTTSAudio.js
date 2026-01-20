import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { requestTTS } from '../api/tts';
import { ttsPlaybackStarted, ttsPlaybackEnded } from '../store/slices/speakingStatsSlice';

// key(text+voice) -> audioUrl
const ttsCache = new Map();
// key(text+voice) -> Promise<audioUrl>
const ttsInFlight = new Map();

function makeKey(text, voiceId) {
  return `${voiceId || 'default'}::${text}`;
}

/**
 * 서버 TTS(/api/tts)로 음성 URL 받아 재생하는 훅
 * Redux와 연동하여 재생 시간을 추적합니다.
 * SQS 비동기 처리 지원 (캐시 미스 시 폴링)
 */
export function useTTSAudio() {
  const dispatch = useDispatch();
  const [isPlaying, setIsPlaying] = useState(false);
  const [ttsStatus, setTtsStatus] = useState('idle'); // 'idle' | 'generating' | 'playing'
  const [error, setError] = useState(null);
  const [lastPlaybackDuration, setLastPlaybackDuration] = useState(0);
  const audioRef = useRef(null);
  const playbackStartTimeRef = useRef(null);

  const stop = useCallback(() => {
    try {
      if (audioRef.current) {
        // 재생 중지 시 duration 계산
        if (playbackStartTimeRef.current) {
          const endTime = Date.now();
          const duration = endTime - playbackStartTimeRef.current;
          setLastPlaybackDuration(duration);

          // Redux에 알림
          dispatch(ttsPlaybackEnded({ duration, endTime }));
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } finally {
      setIsPlaying(false);
      setTtsStatus('idle');
      playbackStartTimeRef.current = null;
    }
  }, [dispatch]);

  // 페이지 이동/언마운트 시에도 재생 중이면 즉시 중지
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const playText = useCallback(async (text, { voiceId, language = 'en' } = {}) => {
    if (!text || typeof text !== 'string') return;
    setError(null);

    const key = makeKey(text, voiceId);

    try {
      stop();

      // cache hit
      let audioUrl = ttsCache.get(key);
      if (!audioUrl) {
        // TTS 생성 중 상태 표시
        setTtsStatus('generating');

        let promise = ttsInFlight.get(key);
        if (!promise) {
          promise = requestTTS({
            text,
            voiceId,
            language,
            pollingOptions: {
              onRetry: (attempt, maxAttempts) => {
                // 폴링 진행 상태를 로그로 표시 (필요시 UI에 반영 가능)
                console.log(`TTS 생성 중... (${attempt}/${maxAttempts})`);
              }
            }
          }).then((res) => res?.audioUrl);
          ttsInFlight.set(key, promise);
        }
        audioUrl = await promise;
        ttsInFlight.delete(key);
        if (audioUrl) ttsCache.set(key, audioUrl);
      }

      if (!audioUrl) throw new Error('TTS audioUrl이 없습니다.');

      // 재생 준비
      setTtsStatus('playing');

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      // 재생 시작 이벤트
      audio.onplay = () => {
        const startTime = Date.now();
        playbackStartTimeRef.current = startTime;
        dispatch(ttsPlaybackStarted({ startTime }));
      };

      // 재생 종료 이벤트
      audio.onended = () => {
        const endTime = Date.now();
        const duration = playbackStartTimeRef.current
          ? endTime - playbackStartTimeRef.current
          : 0;

        setLastPlaybackDuration(duration);
        setIsPlaying(false);
        setTtsStatus('idle');
        playbackStartTimeRef.current = null;

        // Redux에 알림
        dispatch(ttsPlaybackEnded({ duration, endTime }));
      };

      audio.onerror = () => {
        setError('오디오 재생에 실패했습니다.');
        setIsPlaying(false);
        setTtsStatus('idle');
        playbackStartTimeRef.current = null;
      };

      setIsPlaying(true);
      await audio.play();

      // 오디오 duration 반환 (가능한 경우)
      return audio.duration ? audio.duration * 1000 : null;
    } catch (e) {
      setIsPlaying(false);
      setTtsStatus('idle');
      playbackStartTimeRef.current = null;
      setError(e?.message || 'TTS 재생 실패');
    }
  }, [stop, dispatch]);

  // 오디오 duration 가져오기
  const getAudioDuration = useCallback(() => {
    if (audioRef.current && audioRef.current.duration) {
      return audioRef.current.duration * 1000; // ms 변환
    }
    return lastPlaybackDuration;
  }, [lastPlaybackDuration]);

  return {
    playText,
    stop,
    isPlaying,
    ttsStatus, // 'idle' | 'generating' | 'playing'
    error,
    lastPlaybackDuration,
    getAudioDuration,
  };
}

