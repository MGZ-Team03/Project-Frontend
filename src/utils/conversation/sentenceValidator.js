import { toWords } from 'number-to-words';

/**
 * Levenshtein Distance (편집 거리) 계산
 * 두 문자열 간 최소 편집 횟수를 반환
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j],     // 삭제
          dp[i][j - 1],     // 삽입
          dp[i - 1][j - 1]  // 치환
        ) + 1;
      }
    }
  }
  return dp[m][n];
}

/**
 * 편집 거리 기반 유사도 계산 (0~100%)
 */
function editDistanceSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLen = Math.max(str1.length, str2.length);

  if (maxLen === 0) return 100;

  return ((maxLen - distance) / maxLen) * 100;
}

/**
 * 단어 일치율 계산 (0~100%)
 * 예문에 있는 단어들이 발화에 얼마나 포함되어 있는지
 */
function wordMatchRatio(expected, spoken) {
  // 구두점 제거 및 소문자 변환
  const expectedWords = expected
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  const spokenWords = spoken
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (expectedWords.length === 0) return 0;

  // 예문의 각 단어가 발화에 포함되어 있는지 확인
  const matchCount = expectedWords.filter(word =>
    spokenWords.includes(word)
  ).length;

  return (matchCount / expectedWords.length) * 100;
}

/**
 * 피드백 메시지 생성
 */
function getFeedback(finalScore, wordMatch, editSimilarity) {
  if (finalScore >= 95) {
    return {
      message: "완벽합니다! 🎉",
      severity: "success"
    };
  }

  if (finalScore >= 85) {
    return {
      message: "잘했어요! 다음 문장으로 이동할 수 있습니다. ✅",
      severity: "success"
    };
  }

  if (wordMatch < 80) {
    return {
      message: "중요한 단어가 빠졌습니다. 예문을 다시 확인하고 정확히 읽어주세요. ❌",
      severity: "error"
    };
  }

  if (editSimilarity < 70) {
    return {
      message: "발음이 예문과 다릅니다. 천천히 정확하게 따라 읽어주세요. ❌",
      severity: "warning"
    };
  }

  return {
    message: "조금 더 정확하게 읽어주세요. ❌",
    severity: "error"
  };
}

/**
 * 숫자를 영어 단어로 변환 (예: "7" -> "seven")
 */
function normalizeNumbers(text) {
  if (!text) return '';
  return text.replace(/\d+/g, (number) => {
    try {
      // 콤마 제거 및 하이픈을 공백으로 변환 (twenty-one -> twenty one)
      return toWords(number).replace(/,/g, '').replace(/-/g, ' ');
    } catch (e) {
      console.error('Number normalization error:', e);
      return number;
    }
  });
}

/**
 * 문장 유사도 검증 (하이브리드 방식)
 *
 * @param {string} expected - 예문 (정답)
 * @param {string} spoken - 사용자가 말한 문장 (STT 결과)
 * @returns {Object} 검증 결과
 *   - score: 최종 점수 (0~100)
 *   - passed: 통과 여부 (boolean)
 *   - wordMatch: 단어 일치율 (0~100)
 *   - editSimilarity: 편집 거리 유사도 (0~100)
 *   - feedback: 피드백 객체 { message, severity }
 */
export function validateSentence(expected, spoken) {
  // 1. 숫자 변환 (7 -> seven)
  const normalizedExpected = normalizeNumbers(expected);
  const normalizedSpoken = normalizeNumbers(spoken);

  // 2. 전처리 (소문자, 특수문자 제거)
  const cleanExpected = normalizedExpected.toLowerCase().replace(/[^\w\s]/g, '');
  const cleanSpoken = normalizedSpoken.toLowerCase().replace(/[^\w\s]/g, '');

  // 3. 단어 일치율 계산 (가중치 70% - 단어 누락에 더 엄격)
  const wordMatch = wordMatchRatio(normalizedExpected, normalizedSpoken);

  // 4. Levenshtein 유사도 계산 (가중치 30%)
  const editSimilarity = editDistanceSimilarity(cleanExpected, cleanSpoken);

  // 5. 가중 평균으로 최종 점수 계산
  const finalScore = (wordMatch * 0.7) + (editSimilarity * 0.3);

  // 6. 통과 기준: 85% 이상 (더 엄격한 기준)
  const passed = finalScore >= 85;

  // 7. 피드백 생성
  const feedback = getFeedback(finalScore, wordMatch, editSimilarity);

  return {
    score: Math.round(finalScore * 10) / 10, // 소수점 1자리
    passed,
    wordMatch: Math.round(wordMatch * 10) / 10,
    editSimilarity: Math.round(editSimilarity * 10) / 10,
    feedback,
    expected: cleanExpected,
    spoken: cleanSpoken
  };
}
