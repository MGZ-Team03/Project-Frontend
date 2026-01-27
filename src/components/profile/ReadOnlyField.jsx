export default function ReadOnlyField({
  label,
  value,
  description,
  descriptionClassName = '',
  inputClassName = '',
  containerClassName = '',
  endAdornment = null,
}) {
  return (
    <div className={`flex flex-col gap-2 opacity-80 ${containerClassName}`.trim()}>
      <div className="flex justify-between items-center">
        <label className="text-[#111418] dark:text-white text-sm font-semibold">{label}</label>
        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-sm">lock</span>
      </div>
      <div className="relative">
        <input
          type="text"
          value={value}
          readOnly
          className={[
            'w-full rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed h-12 px-4 text-sm',
            endAdornment ? 'pr-12' : '',
            inputClassName,
          ].join(' ').trim()}
        />
        {endAdornment && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {endAdornment}
          </div>
        )}
      </div>
      {description && (
        <p className={['text-slate-400 dark:text-slate-500 text-xs', descriptionClassName].join(' ').trim()}>
          {description}
        </p>
      )}
    </div>
  );
}
