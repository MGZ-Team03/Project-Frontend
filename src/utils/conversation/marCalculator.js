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
 * MAR (Mouth Aspect Ratio) 계산
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
