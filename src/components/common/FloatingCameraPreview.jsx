import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

function getSessionHeaderHeight() {
  try {
    const el = document?.querySelector?.('[data-session-header="true"]');
    return el?.getBoundingClientRect?.().height || 0;
  } catch (_) {
    return 0;
  }
}

export default function FloatingCameraPreview({
  videoRef,
  canvasRef,
  showGrid,
  setShowGrid,
  showMouthLandmarks,
  setShowMouthLandmarks,
  minWidth = 200,
  minHeight = 140,
  maxWidth = 520,
  maxHeight = 360,
  defaultSize = { width: 240, height: 150 },
  zIndex = 2000,
  title = 'Live Preview',
}) {
  const [wndPos, setWndPos] = useState({ x: 24, y: 24 });
  const [wndSize, setWndSize] = useState(defaultSize);

  const resizeHandleStyles = useMemo(
    () => ({
      top: { cursor: 'ew-resize' },
      right: { cursor: 'ew-resize' },
      bottom: { cursor: 'ew-resize' },
      left: { cursor: 'ew-resize' },
      topRight: { cursor: 'ew-resize' },
      bottomRight: { cursor: 'ew-resize' },
      bottomLeft: { cursor: 'ew-resize' },
      topLeft: { cursor: 'ew-resize' },
    }),
    []
  );

  // keep window inside viewport; default position is top-right below session header
  useEffect(() => {
    const margin = 24;

    const clampOnce = () => {
      const headerHeight = getSessionHeaderHeight();
      const defaultTopY = Math.max(margin, Math.round(headerHeight + margin));

      setWndPos((prev) => {
        const w = wndSize?.width || defaultSize.width;
        const h = wndSize?.height || defaultSize.height;
        const maxX = Math.max(margin, (window?.innerWidth || 1200) - w - margin);
        const maxY = Math.max(margin, (window?.innerHeight || 800) - h - margin);

        const wantsDefaultPlacement = prev?.x === 24 && prev?.y === 24;
        const desiredX = wantsDefaultPlacement ? maxX : Math.min(Math.max(prev?.x ?? margin, margin), maxX);
        const desiredY = wantsDefaultPlacement ? defaultTopY : Math.min(Math.max(prev?.y ?? margin, margin), maxY);

        if (desiredX === prev.x && desiredY === prev.y) return prev;
        return { x: desiredX, y: desiredY };
      });
    };

    clampOnce();
    window.addEventListener('resize', clampOnce);
    return () => window.removeEventListener('resize', clampOnce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wndSize?.width, wndSize?.height]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <Rnd
      bounds="window"
      size={wndSize}
      position={wndPos}
      style={{ position: 'fixed', zIndex }}
      resizeHandleStyles={resizeHandleStyles}
      minWidth={minWidth}
      minHeight={minHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      dragHandleClassName="camera-drag-handle"
      onDragStop={(_, d) => setWndPos({ x: d.x, y: d.y })}
      onResizeStop={(_, __, ref, ___, pos) => {
        const nextW = parseInt(ref.style.width, 10);
        const nextH = parseInt(ref.style.height, 10);
        setWndSize({
          width: Number.isFinite(nextW) ? nextW : wndSize.width,
          height: Number.isFinite(nextH) ? nextH : wndSize.height,
        });
        setWndPos(pos);
      }}
    >
      <div className="relative w-full h-full rounded-md overflow-hidden shadow-2xl border border-white/80 dark:border-gray-800 bg-gray-200 group">
        <div className="camera-drag-handle absolute inset-x-0 top-0 h-7 bg-black/50 backdrop-blur-sm flex items-center justify-between px-2 text-white cursor-move z-10">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-black tracking-wider">{title}</span>
          </div>
        </div>

        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />

        <button
          type="button"
          className="absolute top-9 left-2 bg-black/60 p-1 rounded text-white hover:bg-primary transition"
          onClick={() => setShowGrid((v) => !v)}
          title="Grid"
          aria-label="Grid"
        >
          <span className="material-symbols-outlined text-sm">{showGrid ? 'grid_on' : 'grid_off'}</span>
        </button>
        <button
          type="button"
          className="absolute top-9 right-2 bg-black/60 p-1 rounded text-white hover:bg-primary transition"
          onClick={() => setShowMouthLandmarks((v) => !v)}
          title="Mouth landmarks"
          aria-label="Mouth landmarks"
        >
          <span className="material-symbols-outlined text-sm">
            {showMouthLandmarks ? 'sentiment_satisfied_alt' : 'sentiment_satisfied'}
          </span>
        </button>
      </div>
    </Rnd>,
    document.body
  );
}

