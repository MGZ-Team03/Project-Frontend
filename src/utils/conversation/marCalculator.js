import { CONFIG } from '../../config/speakingConfig';

/**
 * 두 점 사이의 유클리드 거리 계산
 * @param {Object} point1 - {x, y} 좌표
 * @param {Object} point2 - {x, y} 좌표
 * @returns {number} 거리
 */
export function calculateDistance(point1, point2) {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 중앙값 계산 (이상치에 강함)
 * @param {Array<number>} values - 숫자 배열
 * @returns {number} 중앙값
 */
function median(values) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * MAR (Mouth Aspect Ratio) 계산 - 기존 2-point 방식
 * MAR = vertical_distance / horizontal_distance
 *
 * @param {Array} landmarks - MediaPipe 얼굴 랜드마크 배열 (478개 포인트)
 * @returns {number} MAR 값 (0~1 범위, 입이 열릴수록 큼)
 */
export function calculateMAR(landmarks) {
  if (!landmarks || landmarks.length < 309) {
    return 0;
  }

  const upperLip = landmarks[CONFIG.LANDMARKS.UPPER_LIP];
  const lowerLip = landmarks[CONFIG.LANDMARKS.LOWER_LIP];
  const leftMouth = landmarks[CONFIG.LANDMARKS.LEFT_MOUTH];
  const rightMouth = landmarks[CONFIG.LANDMARKS.RIGHT_MOUTH];

  const vertical = calculateDistance(upperLip, lowerLip);
  const horizontal = calculateDistance(leftMouth, rightMouth);

  // 0으로 나누기 방지
  if (horizontal === 0) {
    return 0;
  }

  return vertical / horizontal;
}

/**
 * Multi-Point MAR 계산 - 6-point 방식 (개선된 정확도)
 * 입술 외곽선의 좌/중/우 세 지점에서 평균을 구함
 *
 * @param {Array} landmarks - MediaPipe 얼굴 랜드마크 배열
 * @returns {number} MAR 값 (0~1 범위)
 */
export function calculateMultiPointMAR(landmarks) {
  if (!landmarks || landmarks.length < 309) {
    return 0;
  }

  // 가로 거리 (기준)
  const leftMouth = landmarks[CONFIG.LANDMARKS.LEFT_MOUTH];
  const rightMouth = landmarks[CONFIG.LANDMARKS.RIGHT_MOUTH];
  const horizontal = calculateDistance(leftMouth, rightMouth);

  if (horizontal === 0) {
    return 0;
  }

  // 세 지점에서 세로 거리 측정
  const verticals = [
    // 중심
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_LIP],
      landmarks[CONFIG.LANDMARKS.LOWER_LIP]
    ),
    // 좌측
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_LIP_LEFT],
      landmarks[CONFIG.LANDMARKS.LOWER_LIP_LEFT]
    ),
    // 우측
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_LIP_RIGHT],
      landmarks[CONFIG.LANDMARKS.LOWER_LIP_RIGHT]
    ),
  ];

  // 중앙값 사용 (이상치에 강함 - 한 지점 랜드마크 오류 방지)
  const medianVertical = median(verticals);

  return medianVertical / horizontal;
}

/**
 * Inner MAR 계산 - 입술 내부선 간격 측정 (속삭임/조용한 발화 감지)
 * 입술 내부선의 좌/중/우 세 지점에서 평균을 구함
 *
 * @param {Array} landmarks - MediaPipe 얼굴 랜드마크 배열
 * @returns {number} Inner MAR 값 (0~1 범위, 일반 MAR보다 작음)
 */
export function calculateInnerMAR(landmarks) {
  if (!landmarks || landmarks.length < 309) {
    return 0;
  }

  // 가로 거리 (기준)
  const leftMouth = landmarks[CONFIG.LANDMARKS.LEFT_MOUTH];
  const rightMouth = landmarks[CONFIG.LANDMARKS.RIGHT_MOUTH];
  const horizontal = calculateDistance(leftMouth, rightMouth);

  if (horizontal === 0) {
    return 0;
  }

  // 입술 내부선 세 지점에서 세로 거리 측정
  const innerVerticals = [
    // 좌측
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_INNER_LEFT],
      landmarks[CONFIG.LANDMARKS.LOWER_INNER_LEFT]
    ),
    // 중심
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_INNER_CENTER],
      landmarks[CONFIG.LANDMARKS.LOWER_INNER_CENTER]
    ),
    // 우측
    calculateDistance(
      landmarks[CONFIG.LANDMARKS.UPPER_INNER_RIGHT],
      landmarks[CONFIG.LANDMARKS.LOWER_INNER_RIGHT]
    ),
  ];

  // 중앙값 사용 (이상치에 강함 - 한 지점 랜드마크 오류 방지)
  const medianInnerVertical = median(innerVerticals);

  return medianInnerVertical / horizontal;
}
