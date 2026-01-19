/**
 * 지수 백오프를 사용한 폴링 유틸리티
 */

/**
 * Promise를 지연시키는 헬퍼 함수
 * @param {number} ms - 지연 시간 (밀리초)
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 지수 백오프 전략을 사용하여 상태를 폴링합니다
 * @param {Function} statusFn - 상태 확인 함수 (jobId/requestId를 받아 상태 객체를 반환)
 * @param {string} jobId - 작업 ID
 * @param {Object} options - 옵션
 * @param {number} options.initialInterval - 초기 폴링 간격 (기본: 500ms)
 * @param {number} options.maxInterval - 최대 폴링 간격 (기본: 3000ms)
 * @param {number} options.maxAttempts - 최대 시도 횟수 (기본: 30)
 * @param {number} options.backoffMultiplier - 백오프 배수 (기본: 1.5)
 * @param {Function} options.onRetry - 재시도 시 호출되는 콜백
 * @param {AbortSignal} options.signal - AbortController 시그널
 * @returns {Promise<Object>} 완료된 작업 결과
 * @throws {Error} 작업 실패 또는 타임아웃
 */
export async function pollWithBackoff(statusFn, jobId, options = {}) {
  const {
    initialInterval = 500,
    maxInterval = 3000,
    maxAttempts = 30,
    backoffMultiplier = 1.5,
    onRetry = () => {},
    signal = null,
  } = options;

  let interval = initialInterval;
  let lastError = null;

  for (let i = 0; i < maxAttempts; i++) {
    // AbortController로 취소되었는지 확인
    if (signal?.aborted) {
      throw new Error('폴링이 취소되었습니다');
    }

    try {
      const result = await statusFn(jobId);

      // 완료 상태 확인
      if (result.status === 'COMPLETED') {
        return result;
      }

      // 실패 상태 확인
      if (result.status === 'FAILED') {
        throw new Error(result.error || '작업 처리 실패');
      }

      // 처리 중 - 계속 폴링
      if (result.status === 'PROCESSING') {
        onRetry(i + 1, maxAttempts);
        await sleep(interval);
        // 지수 백오프: 점진적으로 간격 증가
        interval = Math.min(interval * backoffMultiplier, maxInterval);
        continue;
      }

      // 알 수 없는 상태
      throw new Error(`알 수 없는 상태: ${result.status}`);
    } catch (error) {
      lastError = error;

      // 네트워크 오류는 재시도
      if (
        error.name === 'NetworkError' ||
        error.code === 'ECONNABORTED' ||
        error.message?.includes('network')
      ) {
        console.warn(`폴링 네트워크 오류 (시도 ${i + 1}/${maxAttempts}):`, error.message);
        await sleep(interval * 2);
        continue;
      }

      // 그 외 오류는 즉시 throw
      throw error;
    }
  }

  // 최대 시도 횟수 초과
  throw lastError || new Error('작업 처리 타임아웃');
}

/**
 * 여러 폴링 작업을 관리하는 AbortController 매니저
 */
export class PollingManager {
  constructor() {
    this.controllers = new Map();
  }

  /**
   * 새 폴링 작업 시작
   * @param {string} id - 작업 ID
   * @returns {AbortController}
   */
  start(id) {
    // 기존 작업이 있으면 중단
    this.abort(id);

    const controller = new AbortController();
    this.controllers.set(id, controller);
    return controller;
  }

  /**
   * 특정 폴링 작업 중단
   * @param {string} id - 작업 ID
   */
  abort(id) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
      this.controllers.delete(id);
    }
  }

  /**
   * 모든 폴링 작업 중단
   */
  abortAll() {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }

  /**
   * 폴링 작업 완료 시 호출
   * @param {string} id - 작업 ID
   */
  complete(id) {
    this.controllers.delete(id);
  }
}

// 전역 폴링 매니저 (페이지 이탈 시 자동 정리)
export const globalPollingManager = new PollingManager();

// 페이지 이탈 시 모든 폴링 중단
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    globalPollingManager.abortAll();
  });
}
