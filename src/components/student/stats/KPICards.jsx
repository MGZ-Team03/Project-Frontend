function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function formatValue(value) {
  if (value == null) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function KpiCard({ label, value, changeText, changeTone = 'positive', secondaryText }) {
  const changeClass =
    changeTone === 'positive'
      ? 'text-[#078838] bg-green-500/10'
      : changeTone === 'negative'
        ? 'text-red-600 bg-red-500/10'
        : 'text-primary bg-primary/10';

  return (
    <div className="flex flex-col gap-2 rounded-xl p-6 bg-white dark:bg-[#1a242f] border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
      <p className="text-[#617589] dark:text-gray-400 text-sm font-semibold">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-black leading-tight text-[#111418] dark:text-white">{formatValue(value)}</p>
        {changeText ? (
          <p className={clsx('text-xs font-black px-1.5 py-0.5 rounded', changeClass)}>{changeText}</p>
        ) : null}
        {secondaryText ? (
          <p className="text-primary text-xs font-black">{secondaryText}</p>
        ) : null}
      </div>
    </div>
  );
}

export default function KPICards({ kpiData, variant }) {
  if (variant === 'statics') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Study Time"
          value={kpiData?.totalTime?.value}
          changeText={kpiData?.totalTime?.change ? `+${kpiData.totalTime.change}%` : null}
        />
        <KpiCard
          label="Conversations"
          value={kpiData?.conversations?.value ?? 0}
          changeText={kpiData?.conversations?.change ? `+${kpiData.conversations.change}%` : null}
        />
        <KpiCard
          label="Current Streak"
          value={kpiData?.streak?.value ?? '0 Days'}
          secondaryText="Best: 0"
        />
        <KpiCard
          label="Avg. Confidence"
          value={kpiData?.confidence?.value ?? '-'}
          changeText={kpiData?.confidence?.change ? `+${kpiData.confidence.change}` : null}
          changeTone="positive"
        />
      </div>
    );
  }

  // fallback (legacy shape)
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard label="총 학습 시간" value={kpiData?.totalTime?.value} />
      <KpiCard label="발음 시간" value={kpiData?.speakingTime?.value} />
      <KpiCard label="연습 횟수" value={`${formatValue(kpiData?.practiceCount?.value)}회`} />
    </div>
  );
}
