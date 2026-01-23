import { useEffect, useMemo, useRef, useState } from 'react';
import { getSentenceAudioSession } from '../api/sentences';
import { globalPollingManager, sleep } from '../utils/polling';

const DEFAULT_SCHEDULE_MS = [0, 500, 1000, 2000, 3000, 5000];

function isFinalized(summary) {
  const pending = summary?.pendingCount;
  if (typeof pending === 'number') return pending <= 0;
  // summary가 없을 수도 있으니 sentences 기반으로도 판단
  return false;
}

/**
 * sessionId 기반 문장별 오디오 상태를 폴링하여 가져오는 훅
 * - 문장별 SQS 처리 특성상 out-of-order 완료를 전제로 함
 * - AbortController로 sessionId 변경/언마운트 시 폴링 중단
 */
export function useSentenceAudioSession(sessionId, options = {}) {
  const {
    enabled = true,
    maxWaitMs = 60000,
    scheduleMs = DEFAULT_SCHEDULE_MS,
  } = options;

  const [data, setData] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setIsPolling(false);
      return;
    }

    const pollId = `sentence-audio:${sessionId}`;
    const controller = globalPollingManager.start(pollId);
    const { signal } = controller;
    startedAtRef.current = Date.now();
    setIsPolling(true);
    setError(null);
    setData(null);

    const run = async () => {
      try {
        for (let i = 0; i < scheduleMs.length; i += 1) {
          if (signal?.aborted) throw new Error('폴링이 취소되었습니다');

          // 0ms 포함 스케줄 지원 (즉시 1회)
          const delay = scheduleMs[i];
          if (delay > 0) await sleep(delay);

          if (signal?.aborted) throw new Error('폴링이 취소되었습니다');

          const res = await getSentenceAudioSession(sessionId, { signal });
          setData(res);

          if (isFinalized(res?.summary)) {
            setIsPolling(false);
            return;
          }

          const elapsed = Date.now() - (startedAtRef.current || Date.now());
          if (elapsed >= maxWaitMs) {
            setIsPolling(false);
            return;
          }

          // 다음 루프는 scheduleMs를 계속 사용하되, 마지막 값 이후에는 5초 캡으로 반복
          if (i === scheduleMs.length - 1) {
            while (true) {
              if (signal?.aborted) throw new Error('폴링이 취소되었습니다');
              const elapsed2 = Date.now() - (startedAtRef.current || Date.now());
              if (elapsed2 >= maxWaitMs) {
                setIsPolling(false);
                return;
              }
              await sleep(scheduleMs[scheduleMs.length - 1] || 5000);
              const res2 = await getSentenceAudioSession(sessionId, { signal });
              setData(res2);
              if (isFinalized(res2?.summary)) {
                setIsPolling(false);
                return;
              }
            }
          }
        }
      } catch (e) {
        if (signal?.aborted) return;
        setError(e?.message || '오디오 상태 조회에 실패했습니다.');
        setIsPolling(false);
      } finally {
        globalPollingManager.complete(pollId);
      }
    };

    run();

    return () => {
      globalPollingManager.abort(pollId);
    };
  }, [enabled, sessionId, maxWaitMs, scheduleMs]);

  const byIndex = useMemo(() => {
    const map = new Map();
    const items = data?.sentences || [];
    for (const item of items) {
      if (typeof item?.index !== 'number') continue;
      // 백엔드가 0-based/1-based 둘 중 무엇을 쓰든 프론트(currentIndex=0-based)에서 매칭되도록 보강
      map.set(item.index, item);
      if (item.index > 0 && !map.has(item.index - 1)) {
        map.set(item.index - 1, item);
      }
    }
    return map;
  }, [data]);

  return {
    data,
    summary: data?.summary || null,
    byIndex,
    isPolling,
    error,
  };
}

