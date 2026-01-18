export const CONFIG = {
  // MediaPipe settings
  MEDIAPIPE_MODEL_URL: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',

  // Face landmark indices for mouth
  LANDMARKS: {
    UPPER_LIP: 13,    // Upper lip center
    LOWER_LIP: 14,    // Lower lip center
    LEFT_MOUTH: 61,   // Left mouth corner
    RIGHT_MOUTH: 291, // Right mouth corner
  },

  // MAR (Mouth Aspect Ratio) threshold for mouth open detection
  MAR_THRESHOLD: 0.08,

  // MAR movement detection (variance/stddev)
  // 최근 N프레임의 MAR 표준편차가 임계값을 넘으면 "입이 움직인다"로 판단
  MAR_STD_WINDOW: 8,          // frames (8 * 50ms ≈ 400ms)
  MAR_STD_THRESHOLD: 0.006,   // 튜닝 필요: 0.003~0.01 사이에서 환경별 조정 권장

  // Audio detection thresholds
  AUDIO_THRESHOLD: 5,      // Minimum volume to be considered speech
  VOICE_OFFSET: 15,        // Volume above noise floor for voice
  NOISE_FLOOR_DECAY: 0.95, // How fast noise floor adapts

  // Voice frequency range for filtering
  VOICE_FREQ_MIN: 300,  // Hz
  VOICE_FREQ_MAX: 3400, // Hz

  // Timer settings
  TIMER_UPDATE_INTERVAL: 50, // ms
};
