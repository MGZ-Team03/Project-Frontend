import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#1a242f] px-3 py-2 shadow-lg">
        <p className="text-xs font-black text-[#617589] dark:text-gray-400">Activity</p>
        <div className="mt-1 space-y-0.5">
          {payload.map((entry, i) => (
            <p key={i} className="text-xs font-semibold" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export default function ActivityCompareChart({ data }) {
  return (
    <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
      <h3 className="font-black text-xl mb-6 text-[#111418] dark:text-white">Vocabulary Growth</h3>
      <p className="-mt-4 mb-6 text-sm text-[#617589] dark:text-gray-400">학습 활동 비교(임시)</p>

      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="w-full sm:w-[260px] h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(219,224,230,0.7)" vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={false} />
              <YAxis axisLine={false} tickLine={false} tick={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="sentence" stackId="a" fill="#137fec" name="문장 연습" barSize={28} radius={[6, 6, 0, 0]} />
              <Bar dataKey="aiChat" stackId="a" fill="#10b981" name="AI 대화" barSize={28} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <div className="size-3 bg-primary rounded-sm"></div>
            <span className="text-xs font-semibold text-[#617589] dark:text-gray-400">Sentence Practice</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 bg-emerald-500 rounded-sm"></div>
            <span className="text-xs font-semibold text-[#617589] dark:text-gray-400">AI Chat</span>
          </div>
        </div>
      </div>
    </section>
  );
}
