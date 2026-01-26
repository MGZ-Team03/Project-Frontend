export default function ReadOnlyField({ label, value, description }) {
  return (
    <div className="flex flex-col gap-2 opacity-80">
      <div className="flex justify-between items-center">
        <label className="text-[#111418] dark:text-white text-sm font-semibold">{label}</label>
        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm">lock</span>
      </div>
      <input
        type="text"
        value={value}
        readOnly
        className="w-full rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed h-12 px-4 text-sm"
      />
      {description && (
        <p className="text-slate-400 dark:text-slate-500 text-xs">{description}</p>
      )}
    </div>
  );
}
