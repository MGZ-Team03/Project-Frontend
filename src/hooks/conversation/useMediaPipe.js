import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { CONFIG } from '../../config/speakingConfig';

/**
 * MediaPipe Face Mesh 훅
 * 얼굴 랜드마크 감지 및 캔버스 오버레이 그리기
 *
 * @param {React.RefObject} videoRef - 비디오 엘리먼트 ref
 * @param {React.RefObject} canvasRef - 캔버스 엘리먼트 ref
 * @param {Object} options
 * @param {boolean} options.showGrid - 얼굴 가이드 그리드 표시 여부
 * @param {boolean} options.showMouthLandmarks - 입술 랜드마크 표시 여부
 * @returns {Object} { landmarks, landmarksRef, isModelLoaded, error }
 */
export function useMediaPipe(videoRef, canvasRef, options = {}) {
  const { showGrid = false, showMouthLandmarks = false } = options;
  const [landmarks, setLandmarks] = useState(null); // throttled UI/debug state
  const landmarksRef = useRef(null); // real-time landmarks without rerender
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [error, setError] = useState(null);
  const faceLandmarkerRef = useRef(null);
  const animationIdRef = useRef(null);
  const showGridRef = useRef(showGrid);
  const showMouthLandmarksRef = useRef(showMouthLandmarks);
  const isRunningRef = useRef(false);
  const lastUpdateAtRef = useRef(0);

  // keep latest flags without re-creating the whole pipeline
  useEffect(() => {
    showGridRef.current = showGrid;
  }, [showGrid]);

  useEffect(() => {
    showMouthLandmarksRef.current = showMouthLandmarks;
  }, [showMouthLandmarks]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        // MediaPipe 비전 태스크 초기화
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        // FaceLandmarker 생성
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: CONFIG.MEDIAPIPE_MODEL_URL,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 1
        });

        if (!cancelled) {
          faceLandmarkerRef.current = faceLandmarker;
          setIsModelLoaded(true);
          console.log('[MediaPipe] Model loaded successfully');
          startLoop();
        }
      } catch (err) {
        console.error('[MediaPipe] Initialization error:', err);
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    function startLoop() {
      // prevent multiple raf loops (StrictMode / effect re-run)
      if (isRunningRef.current || animationIdRef.current) return;
      isRunningRef.current = true;
      lastUpdateAtRef.current = 0;
      animationIdRef.current = requestAnimationFrame(detectLoop);
    }

    function detectLoop() {
      if (cancelled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // 준비될 때까지 대기 (cancelled면 위에서 리턴)
      if (!video || !canvas || !faceLandmarkerRef.current || video.readyState < 2) {
        animationIdRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      try {
        const results = faceLandmarkerRef.current.detectForVideo(
          video,
          performance.now()
        );

        // Throttle state updates to reduce rerender churn (and avoid update-depth warnings in dev)
        const now = performance.now();
        const shouldUpdate =
          lastUpdateAtRef.current === 0 ||
          now - lastUpdateAtRef.current >= CONFIG.TIMER_UPDATE_INTERVAL;

        // Always keep the latest landmarks in ref (no rerender)
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          landmarksRef.current = results.faceLandmarks[0];
        } else {
          landmarksRef.current = null;
        }

        if (shouldUpdate) {
          lastUpdateAtRef.current = now;

          if (landmarksRef.current) {
            // Only update state at throttled rate
            setLandmarks(landmarksRef.current);

            drawOverlay(canvas, video, landmarksRef.current, {
              showGrid: showGridRef.current,
              showMouthLandmarks: showMouthLandmarksRef.current,
            });
          } else {
            setLandmarks(null);
            drawOverlay(canvas, video, null, {
              showGrid: showGridRef.current,
              showMouthLandmarks: showMouthLandmarksRef.current,
            });
          }
        } else {
          // still draw smoothly without forcing React rerender
          drawOverlay(canvas, video, landmarksRef.current, {
            showGrid: showGridRef.current,
            showMouthLandmarks: showMouthLandmarksRef.current,
          });
        }
      } catch (err) {
        console.error('[MediaPipe] Detection error:', err);
      }

      animationIdRef.current = requestAnimationFrame(detectLoop);
    }

    initialize();

    return () => {
      cancelled = true;
      isRunningRef.current = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
        faceLandmarkerRef.current = null;
      }
    };
  }, []); // refs are stable; read .current inside the loop

  return { landmarks, landmarksRef, isModelLoaded, error };
}

/**
 * 캔버스 오버레이 (그리드 + 입 랜드마크)
 */
function drawOverlay(canvas, video, landmarks, { showGrid, showMouthLandmarks }) {
  const ctx = canvas.getContext('2d');
  const width = video.videoWidth;
  const height = video.videoHeight;

  // 캔버스 크기 조정
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  // 캔버스 클리어
  ctx.clearRect(0, 0, width, height);

  if (showGrid) {
    drawGrid(ctx, width, height);
  }

  if (!showMouthLandmarks || !landmarks) return;

  // 입술 랜드마크만 표시
  const mouthLandmarks = [
    CONFIG.LANDMARKS.UPPER_LIP,
    CONFIG.LANDMARKS.LOWER_LIP,
    CONFIG.LANDMARKS.LEFT_MOUTH,
    CONFIG.LANDMARKS.RIGHT_MOUTH,
  ];

  // 입술 점
  ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
  mouthLandmarks.forEach((index) => {
    const p = landmarks[index];
    if (!p) return;
    const x = p.x * width;
    const y = p.y * height;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fill();
  });

  // 입술 랜드마크 연결선(세로/가로)
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const upperLip = landmarks[CONFIG.LANDMARKS.UPPER_LIP];
  const lowerLip = landmarks[CONFIG.LANDMARKS.LOWER_LIP];
  const leftMouth = landmarks[CONFIG.LANDMARKS.LEFT_MOUTH];
  const rightMouth = landmarks[CONFIG.LANDMARKS.RIGHT_MOUTH];

  // 세로선 (위-아래 입술)
  ctx.moveTo(upperLip.x * width, upperLip.y * height);
  ctx.lineTo(lowerLip.x * width, lowerLip.y * height);

  // 가로선 (왼쪽-오른쪽 입꼬리)
  ctx.moveTo(leftMouth.x * width, leftMouth.y * height);
  ctx.lineTo(rightMouth.x * width, rightMouth.y * height);

  ctx.stroke();
}

/**
 * 그리드 오버레이
 */
function drawGrid(ctx, width, height) {
  const cols = 3;
  const rows = 3;

  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;

  for (let i = 1; i < cols; i++) {
    const x = (width / cols) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let j = 1; j < rows; j++) {
    const y = (height / rows) * j;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}
