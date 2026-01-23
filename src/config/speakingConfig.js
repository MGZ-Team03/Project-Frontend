export const CONFIG = {
  // MediaPipe settings
  MEDIAPIPE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',

  // Face landmark indices for mouth
  LANDMARKS: {
    // 기존 포인트 (중심)
    UPPER_LIP: 13,    // Upper lip center
    LOWER_LIP: 14,    // Lower lip center
    LEFT_MOUTH: 61,   // Left mouth corner
    RIGHT_MOUTH: 291, // Right mouth corner

    // Multi-Point MAR을 위한 추가 포인트 (외곽선) - MediaPipe Face Mesh 기준
    UPPER_LIP_LEFT: 185,   // Upper lip left outline
    UPPER_LIP_RIGHT: 40,   // Upper lip right outline
    LOWER_LIP_LEFT: 409,   // Lower lip left outline
    LOWER_LIP_RIGHT: 178,  // Lower lip right outline

    // Inner MAR을 위한 입술 내부선 포인트 - MediaPipe Face Mesh 기준
    UPPER_INNER_LEFT: 78,    // Upper inner lip left
    UPPER_INNER_CENTER: 13,  // Upper inner lip center (same as UPPER_LIP)
    UPPER_INNER_RIGHT: 308,  // Upper inner lip right
    LOWER_INNER_LEFT: 95,    // Lower inner lip left
    LOWER_INNER_CENTER: 14,  // Lower inner lip center (same as LOWER_LIP)
    LOWER_INNER_RIGHT: 324,  // Lower inner lip right
  },

  // MAR (Mouth Aspect Ratio) threshold for mouth open detection
  MAR_THRESHOLD: 0.025,  // 0.03 → 0.025 (카메라 감지 더욱 예민하게)

  // Inner MAR threshold (입술 내부선 간격 - 더 민감한 감지)
  INNER_MAR_THRESHOLD: 0.035,  // 0.04 → 0.035 (내부 입술 감지 강화)

  // MAR movement detection (variance/stddev)
  // 최근 N프레임의 MAR 표준편차가 임계값을 넘으면 "입이 움직인다"로 판단
  MAR_STD_WINDOW: 8,          // frames (8 * 50ms ≈ 400ms)
  MAR_STD_THRESHOLD: 0.0012,  // 0.0015 → 0.0012 (입 움직임 더 예민하게)

  // Audio detection thresholds
  AUDIO_THRESHOLD: 3,      // 5 → 3 (작은 음성도 감지)
  VOICE_OFFSET: 5,         // 8 → 5 (입 움직임과 동기화 개선)
  NOISE_FLOOR_DECAY: 0.95, // How fast noise floor adapts

  // Voice frequency range for filtering
  VOICE_FREQ_MIN: 300,  // Hz
  VOICE_FREQ_MAX: 3400, // Hz

  // Timer settings
  TIMER_UPDATE_INTERVAL: 50, // ms
};
