export default function ProfileImageSection({
  displayImage,
  userName,
  uploading,
  loading,
  pendingImageFile,
  fileInputRef,
  onImageChange,
  onRemoveImage,
  themeColor = '#137fec',
  defaultInitial = '?',
}) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      <div className="relative group">
        {displayImage ? (
          <div
            className="w-32 h-32 rounded-full bg-cover bg-center border-4 border-slate-50 dark:border-slate-800 shadow-lg cursor-pointer"
            style={{ backgroundImage: `url(${displayImage})` }}
            onClick={() => fileInputRef.current?.click()}
          />
        ) : (
          <div
            className="w-32 h-32 rounded-full border-4 border-slate-50 dark:border-slate-800 shadow-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: themeColor }}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="text-white text-4xl font-bold">
              {userName?.[0]?.toUpperCase() || defaultInitial}
            </span>
          </div>
        )}
        
        {pendingImageFile && (
          <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
            미저장
          </div>
        )}
        
        <div
          className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-white text-3xl">photo_camera</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-3 text-center md:text-left">
        <div>
          <p className="text-[#111418] dark:text-white text-xl font-bold">프로필 사진</p>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            사진을 선택한 후 저장 버튼을 눌러주세요.
          </p>
          <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
            JPG, PNG, WebP (최대 5MB)
          </p>
        </div>
        <div className="flex gap-2 justify-center md:justify-start">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className="flex min-w-[100px] items-center justify-center rounded-lg h-10 px-4 text-white text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: themeColor }}
          >
            사진 선택
          </button>
          {(displayImage || pendingImageFile) && (
            <button
              type="button"
              onClick={onRemoveImage}
              disabled={loading || uploading}
              className="flex min-w-[80px] items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              제거
            </button>
          )}
        </div>
      </div>
      
      <input
        type="file"
        ref={fileInputRef}
        hidden
        accept=".jpg,.jpeg,.png,.webp"
        onChange={onImageChange}
      />
    </div>
  );
}
