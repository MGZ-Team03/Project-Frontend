export default function ProfileFormActions({
  onCancel,
  onSubmit,
  loading,
  uploading,
  hasChanges,
  themeColor = '#137fec',
}) {
  return (
    <div className="flex items-center justify-end gap-3 p-8 bg-slate-50/50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        onClick={onCancel}
        className="px-6 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
      >
        취소
      </button>
      <button
        type="submit"
        onClick={onSubmit}
        disabled={loading || uploading}
        className="px-8 py-2.5 rounded-lg text-white text-sm font-bold shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
        style={{ 
          backgroundColor: themeColor,
          boxShadow: `0 10px 15px -3px ${themeColor}33`,
        }}
      >
        {(loading || uploading) ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {uploading ? '업로드 중...' : '저장 중...'}
          </>
        ) : (
          <>
            저장
            {hasChanges && <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded">변경됨</span>}
          </>
        )}
      </button>
    </div>
  );
}
