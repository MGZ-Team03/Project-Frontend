import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function formatSecondsToMinSec(totalSec) {
  const s = Math.max(0, Number(totalSec) || 0);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}분 ${String(r).padStart(2, '0')}초`;
}

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1a242f] px-3 py-2 shadow-lg">
        <p className="text-xs font-black text-[#617589] dark:text-gray-400">{label}</p>
        <div className="mt-1 space-y-0.5">
          {payload.map((entry, index) => (
            <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
              {entry.name}:{' '}
              {entry.dataKey === 'speakingSec'
                ? formatSecondsToMinSec(entry.value)
                : `${entry.value}회`}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function LearningTrendChart({ weeklyData }) {
  const trendData = weeklyData;

  return (
    <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="font-black text-xl text-[#111418] dark:text-white">주간 학습 추이</h3>
          <p className="text-sm text-[#617589] dark:text-gray-400">발화 시간(분/초)과 활동 횟수(연습/대화) 추이</p>
        </div>
        <div className="flex gap-2" />
      </div>

      <div className="h-[300px] min-h-[300px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(219,224,230,0.7)" />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis
              yAxisId="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickFormatter={(v) => formatSecondsToMinSec(v)}
              width={66}
            />
            <YAxis
              yAxisId="count"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={42}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="speakingSec"
              yAxisId="time"
              stroke="#137fec"
              strokeWidth={4}
              dot={false}
              activeDot={{ r: 4 }}
              name="발화"
            />
            <Line
              type="monotone"
              dataKey="practice"
              yAxisId="count"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              activeDot={false}
              name="문장 연습"
            />
            <Line
              type="monotone"
              dataKey="chatTurns"
              yAxisId="count"
              stroke="#a855f7"
              strokeWidth={3}
              dot={false}
              activeDot={false}
              name="AI 대화"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#617589] dark:text-gray-500">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-primary" />
            <span>발화</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
            <span>문장 연습</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-purple-500" />
            <span>AI 대화</span>
          </div>
        </div>
      </div>
    </section>
  );
}
