import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// 커스텀 툴팁
function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1a242f] px-3 py-2 shadow-lg">
        <p className="text-xs font-black text-[#617589] dark:text-gray-400">{label}</p>
        <div className="mt-1 space-y-0.5">
          {payload.map((entry, index) => (
            <p key={index} className="text-xs font-semibold" style={{ color: entry.color }}>
              {entry.name}: {entry.value}분
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
          <h3 className="font-black text-xl text-[#111418] dark:text-white">Fluency Trend</h3>
          <p className="text-sm text-[#617589] dark:text-gray-400">Weekly average speech speed & complexity</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="px-4 py-1.5 text-xs font-black rounded-lg bg-primary text-white">
            Weekly
          </button>
        </div>
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
            <YAxis axisLine={false} tickLine={false} tick={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="speaking"
              stroke="#137fec"
              strokeWidth={4}
              dot={false}
              activeDot={{ r: 4 }}
              name="Speaking"
            />
            <Line
              type="monotone"
              dataKey="practice"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              activeDot={false}
              name="Practice"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.2em] text-[#617589] dark:text-gray-500">
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-primary" />
            <span>Speaking</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
            <span>Practice</span>
          </div>
        </div>
      </div>
    </section>
  );
}
