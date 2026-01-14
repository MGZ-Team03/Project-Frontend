import { useEffect, useRef, useState } from 'react';

/**
 * Web Speech API를 사용한 음성 인식 훅
 *
 * @param {boolean} isListening - 음성 인식 활성화 여부
 * @param {Function} onResult - 음성 인식 결과 콜백 (transcript) => void
 * @param {Function} onError - 에러 콜백 (error) => void
 * @returns {Object} { isSupported, isListening, transcript, startListening, stopListening }
 */
export function useSpeechRecognition(isListening, onResult, onError) {
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);

  useEffect(() => {
    // 브라우저 지원 여부 확인
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error('[STT] Web Speech API not supported');
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    // SpeechRecognition 인스턴스 생성
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US'; // 영어
    recognition.continuous = true; // 계속 인식 (측정 중 여러 번 말할 수 있음)
    recognition.interimResults = false; // 최종 결과만 받기
    recognition.maxAlternatives = 1;

    // 결과 처리 (continuous 모드에서는 마지막 결과를 가져옴)
    recognition.onresult = (event) => {
      // continuous 모드에서는 event.results가 누적되므로 마지막 결과를 가져옴
      const lastResultIndex = event.results.length - 1;
      const spokenText = event.results[lastResultIndex][0].transcript;
      console.log('[STT] Recognized:', spokenText);
      setTranscript(spokenText);

      if (onResult) {
        onResult(spokenText);
      }
    };

    // 에러 처리 (정상적인 중단은 무시)
    recognition.onerror = (event) => {
      // 'aborted'와 'no-speech'는 정상적인 중단이므로 에러로 처리하지 않음
      if (event.error === 'aborted') {
        console.log('[STT] Recognition aborted (normal)');
        return;
      }

      if (event.error === 'no-speech') {
        console.log('[STT] No speech detected');
        return;
      }

      console.error('[STT] Error:', event.error);

      if (onError) {
        onError(event.error);
      }
    };

    // 인식 종료 처리
    recognition.onend = () => {
      console.log('[STT] Recognition ended');
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          // abort() 대신 stop() 사용하여 정상 종료
          recognitionRef.current.stop();
        } catch (err) {
          // 이미 중지된 경우 무시
        }
      }
    };
  }, [onResult, onError]);

  useEffect(() => {
    if (!isSupported || !recognitionRef.current) return;

    if (isListening) {
      try {
        recognitionRef.current.start();
        console.log('[STT] Started listening');
      } catch (err) {
        console.error('[STT] Start error:', err);
      }
    } else {
      try {
        recognitionRef.current.stop();
        console.log('[STT] Stopped listening');
      } catch (err) {
        // Already stopped, ignore
      }
    }
  }, [isListening, isSupported]);

  const startListening = () => {
    if (recognitionRef.current && isSupported) {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error('[STT] Start error:', err);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isSupported) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // Already stopped, ignore
      }
    }
  };

  return {
    isSupported,
    transcript,
    startListening,
    stopListening
  };
}
