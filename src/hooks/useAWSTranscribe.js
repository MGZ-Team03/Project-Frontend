import { useState, useRef, useCallback, useEffect } from 'react';
import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from '@aws-sdk/client-transcribe-streaming';
import { getSTTCredentials } from '../api/stt';

/**
 * PCM 오디오 스트림 생성 (Web Audio API 사용)
 */
async function* createAudioStream(sampleRate) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate,
    },
  });

  const audioContext = new AudioContext({ sampleRate });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  const audioChunks = [];
  let isProcessing = true;

  processor.onaudioprocess = (e) => {
    if (!isProcessing) return;
    const inputData = e.inputBuffer.getChannelData(0);
    // Float32 -> Int16 변환 (PCM)
    const pcmData = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    audioChunks.push(pcmData.buffer);
  };

  source.connect(processor);
  processor.connect(audioContext.destination);

  try {
    while (isProcessing) {
      if (audioChunks.length > 0) {
        yield { AudioEvent: { AudioChunk: audioChunks.shift() } };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    isProcessing = false;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    audioContext.close();
  }
}

/**
 * AWS Transcribe 실시간 STT 훅
 * 기존 useSpeechRecognition을 대체
 */
export function useAWSTranscribe(isRecording, onTranscript, onError) {
  const [transcript, setTranscript] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const clientRef = useRef(null);
  const credentialsRef = useRef(null);
  const isTranscribingRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Credentials 초기화
  useEffect(() => {
    let cancelled = false;

    const initCredentials = async () => {
      try {
        const { credentials, config } = await getSTTCredentials({
          languageCode: 'en-US',
          sampleRate: 16000,
        });

        if (cancelled) return;

        credentialsRef.current = { credentials, config };

        // TranscribeStreamingClient 생성
        clientRef.current = new TranscribeStreamingClient({
          region: config.region,
          credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          },
        });

        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize AWS Transcribe:', error);
        if (onError) onError(error);
      }
    };

    initCredentials();

    return () => {
      cancelled = true;
    };
  }, [onError]);

  // 녹음 시작/중지
  useEffect(() => {
    if (!isInitialized || !clientRef.current || !credentialsRef.current) return;

    if (isRecording && !isTranscribingRef.current) {
      startTranscription();
    } else if (!isRecording && isTranscribingRef.current) {
      stopTranscription();
    }
  }, [isRecording, isInitialized]);

  const startTranscription = async () => {
    if (isTranscribingRef.current) return;
    isTranscribingRef.current = true;

    try {
      const { config } = credentialsRef.current;
      abortControllerRef.current = new AbortController();

      const audioStream = createAudioStream(config.mediaSampleRateHertz || 16000);

      const command = new StartStreamTranscriptionCommand({
        LanguageCode: config.languageCode || 'en-US',
        MediaEncoding: config.mediaEncoding || 'pcm',
        MediaSampleRateHertz: config.mediaSampleRateHertz || 16000,
        AudioStream: audioStream,
      });

      const response = await clientRef.current.send(command, {
        abortSignal: abortControllerRef.current.signal,
      });

      // 실시간 텍스트 수신
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript.Results;
          if (results && results.length > 0) {
            const result = results[0];
            if (result.Alternatives && result.Alternatives.length > 0) {
              const transcriptText = result.Alternatives[0].Transcript;

              if (result.IsPartial) {
                // 부분 결과 (실시간 업데이트)
                setTranscript(transcriptText);
              } else {
                // 최종 결과
                setTranscript(transcriptText);
                if (onTranscript) {
                  onTranscript(transcriptText);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Transcription error:', error);
        if (onError) onError(error);
      }
    } finally {
      isTranscribingRef.current = false;
    }
  };

  const stopTranscription = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isTranscribingRef.current = false;
  };

  return {
    transcript,
    isInitialized,
  };
}
