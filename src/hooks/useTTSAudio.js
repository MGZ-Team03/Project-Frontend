import { useCallback, useEffect, useRef, useState } from 'react';
import { requestTTS } from '../api/tts';

// key(text+voice) -> audioUrl
const ttsCache = new Map();
// key(text+voice) -> Promise<audioUrl>
const ttsInFlight = new Map();

// TTS 캐시 최대 크기 (메모리 누수 방지)
const MAX_TTS_CACHE_SIZE = 50;

function makeKey(text, voiceId, language) {
  return `${voiceId || 'default'}::${language || 'default'}::${text}`;
}

/**
 * 서버 TTS(/api/tts)로 음성 URL 받아 재생하는 훅
 * Redux와 연동하여 재생 시간을 추적합니다.
 * SQS 비동기 처리 지원 (캐시 미스 시 폴링)
 */
export function useTTSAudio() {
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
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    } finally {
      setIsPlaying(false);
      setTtsStatus('idle');
      playbackStartTimeRef.current = null;
    }
  }, []);

  // 페이지 이동/언마운트 시에도 재생 중이면 즉시 중지
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const playUrl = useCallback(async (audioUrl) => {
    if (!audioUrl || typeof audioUrl !== 'string') return null;
    setError(null);

    try {
      stop();

      setTtsStatus('playing');
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        const startTime = Date.now();
        playbackStartTimeRef.current = startTime;
      };

      audio.onended = () => {
        const endTime = Date.now();
        const duration = playbackStartTimeRef.current
          ? endTime - playbackStartTimeRef.current
          : 0;

        setLastPlaybackDuration(duration);
        setIsPlaying(false);
        setTtsStatus('idle');
        playbackStartTimeRef.current = null;
      };

      audio.onerror = () => {
        setError('오디오 재생에 실패했습니다.');
        setIsPlaying(false);
        setTtsStatus('idle');
        playbackStartTimeRef.current = null;
      };

      setIsPlaying(true);
      await audio.play();
      return audio.duration ? audio.duration * 1000 : null;
    } catch (e) {
      setIsPlaying(false);
      setTtsStatus('idle');
      playbackStartTimeRef.current = null;
      setError(e?.message || 'TTS 재생 실패');
      return null;
    }
  }, [stop]);

  const playText = useCallback(async (text, { voiceId, language } = {}) => {
    if (!text || typeof text !== 'string') return null;
    setError(null);

    const key = makeKey(text, voiceId, language);

    try {
      stop();

      let audioUrl = ttsCache.get(key);
      if (!audioUrl) {
        setTtsStatus('generating');

        let promise = ttsInFlight.get(key);
        if (!promise) {
          promise = requestTTS({
            text,
            voiceId,
            language,
            pollingOptions: {
              onRetry: (attempt, maxAttempts) => {
                console.log(`TTS 생성 중... (${attempt}/${maxAttempts})`);
              }
            }
          }).then((res) => res?.audioUrl);
          ttsInFlight.set(key, promise);
        }
        audioUrl = await promise;
        ttsInFlight.delete(key);
        if (audioUrl) {
          // 캐시 크기 제한 (메모리 누수 방지: 오래된 항목 제거)
          if (ttsCache.size >= MAX_TTS_CACHE_SIZE) {
            const firstKey = ttsCache.keys().next().value;
            ttsCache.delete(firstKey);
          }
          ttsCache.set(key, audioUrl);
        }
      }

      if (!audioUrl) throw new Error('TTS audioUrl이 없습니다.');
      return await playUrl(audioUrl);
    } catch (e) {
      setIsPlaying(false);
      setTtsStatus('idle');
      playbackStartTimeRef.current = null;
      setError(e?.message || 'TTS 재생 실패');
      return null;
    }
  }, [stop, playUrl]);

  // 오디오 duration 가져오기
  const getAudioDuration = useCallback(() => {
    if (audioRef.current && audioRef.current.duration) {
      return audioRef.current.duration * 1000; // ms 변환
    }
    return lastPlaybackDuration;
  }, [lastPlaybackDuration]);

  return {
    playText,
    playUrl,
    stop,
    isPlaying,
    ttsStatus, // 'idle' | 'generating' | 'playing'
    error,
    lastPlaybackDuration,
    getAudioDuration,
  };
}

