import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Text-to-Speech 훅
 * Web Speech API의 SpeechSynthesis를 사용하여 텍스트를 음성으로 변환
 *
 * @returns {Object} { speak, stop, isSpeaking, error }
 */
export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const utteranceRef = useRef(null);

  // SpeechSynthesis 사용 가능 여부 확인
  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setError('TTS is not supported in this browser');
      console.error('[TTS] SpeechSynthesis API not available');
    }
  }, []);

  /**
   * 텍스트를 음성으로 재생
   *
   * @param {string} text - 읽을 텍스트
   * @param {Object} options - TTS 옵션
   * @param {string} options.lang - 언어 코드 (기본값: 'en-US')
   * @param {number} options.rate - 속도 (0.1~10, 기본값: 0.9)
   * @param {number} options.pitch - 음높이 (0~2, 기본값: 1)
   * @param {number} options.volume - 볼륨 (0~1, 기본값: 1)
   */
  const speak = useCallback((text, options = {}) => {
    // 기존 재생 중지
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    if (!text || typeof text !== 'string') {
      console.warn('[TTS] Invalid text provided:', text);
      return;
    }

    const {
      lang = 'en-US',
      rate = 0.9,
      pitch = 1,
      volume = 1
    } = options;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      // 이벤트 핸들러
      utterance.onstart = () => {
        console.log('[TTS] Started speaking:', text.substring(0, 50));
        setIsSpeaking(true);
        setError(null);
      };

      utterance.onend = () => {
        console.log('[TTS] Finished speaking');
        setIsSpeaking(false);
      };

      utterance.onerror = (event) => {
        console.error('[TTS] Error:', event.error);
        setError(event.error);
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);

    } catch (err) {
      console.error('[TTS] Failed to speak:', err);
      setError(err.message);
      setIsSpeaking(false);
    }
  }, []);

  /**
   * 현재 재생 중인 TTS 중지
   */
  const stop = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      console.log('[TTS] Stopped speaking');
    }
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    error
  };
}
