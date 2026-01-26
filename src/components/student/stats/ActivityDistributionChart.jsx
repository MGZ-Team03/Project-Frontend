import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const p = payload[0];
    return (
      <div className="rounded-lg border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1a242f] px-3 py-2 shadow-lg">
        <p className="text-xs font-black text-[#617589] dark:text-gray-400">{p?.name}</p>
        <p className="mt-1 text-xs font-semibold text-[#111418] dark:text-white">{p?.value}%</p>
      </div>
    );
  }
  return null;
}

export default function ActivityDistributionChart({ data }) {
  return (
    <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm flex flex-col items-center">
      <div className="w-full text-left mb-6">
        <h3 className="font-black text-xl text-[#111418] dark:text-white">학습 활동 분포</h3>
        <p className="text-sm text-[#617589] dark:text-gray-400">발화시간 기준 · 문장 연습 vs AI 대화 비중</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
        <div className="w-[240px] h-[240px] overflow-visible min-w-0">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="58%"
                outerRadius="85%"
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full">
          {data.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="size-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
              <span className="text-xs font-semibold text-[#111418] dark:text-white">
                {item.value}% {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
