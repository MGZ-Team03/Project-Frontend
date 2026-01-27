function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function ProgressRing({ valuePercent }) {
  const size = 96;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, valuePercent || 0));
  const dash = (pct / 100) * c;

  return (
    <svg width={size} height={size} className="absolute inset-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={stroke}
        className="text-white/15"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="transparent"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="text-white"
      />
    </svg>
  );
}

export default function RecordingButton({
  isRecording,
  progressPercent = 0,
  disabled = false,
  onClick,
  titleIdle = 'Record',
  titleRecording = 'Stop',
  className,
}) {
  const title = isRecording ? titleRecording : titleIdle;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        'relative flex items-center justify-center rounded-full bg-primary h-24 w-24 text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
      title={title}
      aria-label={title}
    >
      {isRecording && <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />}
      {isRecording ? <ProgressRing valuePercent={progressPercent} /> : null}
      <span className="material-symbols-outlined text-4xl">{isRecording ? 'stop' : 'mic'}</span>
    </button>
  );
}

