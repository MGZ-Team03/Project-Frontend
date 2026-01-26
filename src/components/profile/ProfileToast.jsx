export default function ProfileToast({ success, error, onSuccessClose, onErrorClose }) {
  return (
    <>
      {success && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="text-sm font-medium">프로필이 업데이트되었습니다</span>
            <button onClick={onSuccessClose} className="ml-2 hover:opacity-80">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg">
            <span className="material-symbols-outlined">error</span>
            <span className="text-sm font-medium">{error}</span>
            <button onClick={onErrorClose} className="ml-2 hover:opacity-80">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
