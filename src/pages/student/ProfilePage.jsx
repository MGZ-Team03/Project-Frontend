import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from '../../store/slices/authSlice';
import { uploadProfileImage } from '../../api/auth';
import StudentLayout from '../../components/common/StudentLayout';

// 학습 레벨 (value는 AI 분석 결과로 자동 설정됨)
const LEVELS = [
  { value: 'beginner', label: '하 (초급)' },
  { value: 'intermediate', label: '중 (중급)' },
  { value: 'advanced', label: '상 (고급)' },
];

export default function ProfilePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const fileInputRef = useRef(null);
  
  const [form, setForm] = useState({ name: '' });
  const [profileImage, setProfileImage] = useState(null);
  const [pendingImageFile, setPendingImageFile] = useState(null); // 저장 대기 중인 파일
  const [previewUrl, setPreviewUrl] = useState(null); // 로컬 미리보기 URL
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [removeImage, setRemoveImage] = useState(false); // 이미지 제거 플래그

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '' });
      setProfileImage(user.profileImage || null);
    }
  }, [user]);

  // 미리보기 URL 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 지원하는 이미지 형식만 허용
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('JPG, PNG, WebP 형식만 업로드 가능합니다');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 합니다');
      return;
    }

    // 이전 미리보기 URL 정리
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    // 로컬 미리보기 생성 (저장 버튼 누를 때까지 대기)
    const newPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(newPreviewUrl);
    setPendingImageFile(file);
    setRemoveImage(false);
    setError(null);
  };

  const handleRemoveImage = () => {
    // 미리보기 URL 정리
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPendingImageFile(null);
    setRemoveImage(true);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('이름을 입력해주세요');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      let newImageUrl = profileImage;

      // 이미지 제거 요청
      if (removeImage) {
        newImageUrl = '';
      }
      // 새 이미지 업로드
      else if (pendingImageFile) {
        setUploading(true);
        newImageUrl = await uploadProfileImage(pendingImageFile);
        setUploading(false);
      }

      // 프로필 업데이트 (이름 + 이미지)
      const updateData = { ...form };
      // 이미지 변경이 있으면 항상 포함
      if (removeImage || pendingImageFile) {
        updateData.profileImage = newImageUrl;
      }

      await dispatch(updateProfile(updateData)).unwrap();
      
      // 상태 초기화
      setProfileImage(newImageUrl || null);
      setPendingImageFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setRemoveImage(false);
      setSuccess(true);
    } catch (err) {
      console.error('Profile update failed:', err);
      setError('프로필 업데이트에 실패했습니다');
      setUploading(false);
    }
    setLoading(false);
  };

  // 현재 표시할 이미지 (미리보기 > 기존 이미지)
  const displayImage = removeImage ? null : (previewUrl || profileImage);
  const hasChanges = pendingImageFile || removeImage || form.name !== (user?.name || '');

  const getLevelLabel = () => {
    const level = LEVELS.find(l => l.value === user?.learningLevel);
    return level?.label || '분석 중...';
  };

  return (
    <StudentLayout>
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white dark:bg-[#1a202c] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d3748] overflow-hidden">
          {/* 페이지 헤딩 */}
          <div className="border-b border-slate-100 dark:border-[#2d3748] p-8">
            <h3 className="text-2xl font-black text-[#111418] dark:text-white tracking-tight">프로필 설정</h3>
            <p className="text-slate-500 dark:text-[#a0aec0] mt-1">개인 정보를 업데이트하세요.</p>
          </div>

          <div className="p-8 space-y-8">
            {/* 프로필 이미지 섹션 */}
            <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative group">
                  {displayImage ? (
                    <div
                      className="w-32 h-32 rounded-full bg-cover bg-center border-4 border-slate-50 shadow-lg cursor-pointer"
                      style={{ backgroundImage: `url(${displayImage})` }}
                      onClick={() => fileInputRef.current?.click()}
                    />
                  ) : (
                    <div
                      className="w-32 h-32 rounded-full bg-[#2b8cee] border-4 border-slate-50 shadow-lg flex items-center justify-center cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className="text-white text-4xl font-bold">
                        {user?.name?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  {/* 변경 대기 중 표시 */}
                  {pendingImageFile && (
                    <div className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                      미저장
                    </div>
                  )}
                  {/* 호버 오버레이 */}
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
                    <p className="text-slate-500 dark:text-[#a0aec0] text-sm mt-1">
                      사진을 선택한 후 저장 버튼을 눌러주세요.
                    </p>
                    <p className="text-slate-400 dark:text-[#718096] text-xs mt-1">
                      JPG, PNG, WebP (최대 5MB)
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center md:justify-start">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || loading}
                      className="flex min-w-[100px] items-center justify-center rounded-lg h-10 px-4 bg-[#2b8cee] text-white text-sm font-bold transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    >
                      사진 선택
                    </button>
                    {(displayImage || pendingImageFile) && (
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        disabled={loading || uploading}
                        className="flex min-w-[80px] items-center justify-center rounded-lg h-10 px-4 bg-slate-100 dark:bg-[#2d3748] text-slate-700 dark:text-[#a0aec0] text-sm font-bold hover:bg-slate-200 dark:hover:bg-[#4a5568] transition-colors disabled:opacity-50"
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
                  onChange={handleImageChange}
                />
              </div>

              {/* 폼 필드 */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 이름 */}
                <div className="flex flex-col gap-2">
                  <label className="text-[#111418] dark:text-white text-sm font-semibold">이름</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="이름을 입력하세요"
                    className="w-full rounded-lg border border-slate-200 dark:border-[#4a5568] bg-white dark:bg-[#2d3748] text-[#111418] dark:text-white focus:ring-2 focus:ring-[#2b8cee]/20 focus:border-[#2b8cee] transition-all h-12 px-4 text-sm"
                    required
                  />
                </div>

                {/* 이메일 (읽기 전용) */}
                <div className="flex flex-col gap-2 opacity-80">
                  <div className="flex justify-between items-center">
                    <label className="text-[#111418] dark:text-white text-sm font-semibold">이메일</label>
                    <span className="material-symbols-outlined text-slate-400 dark:text-[#718096] text-sm">lock</span>
                  </div>
                  <input
                    type="email"
                    value={user?.email || ''}
                    readOnly
                    className="w-full rounded-lg border border-slate-100 dark:border-[#4a5568] bg-slate-50 dark:bg-[#1a202c] text-slate-500 dark:text-[#a0aec0] cursor-not-allowed h-12 px-4 text-sm"
                  />
                </div>

                {/* 학습 레벨 (읽기 전용) */}
                <div className="flex flex-col gap-2 opacity-80">
                  <div className="flex justify-between items-center">
                    <label className="text-[#111418] dark:text-white text-sm font-semibold">학습 레벨 (AI 분석)</label>
                    <span className="material-symbols-outlined text-slate-400 dark:text-[#718096] text-sm">lock</span>
                  </div>
                  <input
                    type="text"
                    value={getLevelLabel()}
                    readOnly
                    className="w-full rounded-lg border border-slate-100 dark:border-[#4a5568] bg-slate-50 dark:bg-[#1a202c] text-slate-500 dark:text-[#a0aec0] cursor-not-allowed h-12 px-4 text-sm"
                  />
                  <p className="text-slate-400 dark:text-[#718096] text-xs">전월 학습 데이터를 기반으로 자동 산출됩니다</p>
                </div>

                {/* AI 안내 */}
                <div className="bg-[#2b8cee]/5 dark:bg-[#2b8cee]/10 border border-[#2b8cee]/20 rounded-xl p-4 flex gap-4">
                  <span className="material-symbols-outlined text-[#2b8cee]">auto_awesome</span>
                  <p className="text-sm text-slate-600 dark:text-[#a0aec0]">
                    <strong className="text-[#111418] dark:text-white">AI 안내:</strong>{' '}
                    학습 레벨은 지난달 학습 데이터를 분석하여 자동으로 산출됩니다.
                  </p>
                </div>
              </form>
            </div>

            {/* 푸터 액션 */}
            <div className="flex items-center justify-end gap-3 p-8 bg-slate-50/50 dark:bg-[#0d141c] border-t border-slate-100 dark:border-[#2d3748]">
              <button
                type="button"
                onClick={() => navigate('/home')}
                className="px-6 py-2.5 rounded-lg text-slate-600 dark:text-[#a0aec0] text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="px-8 py-2.5 rounded-lg bg-[#2b8cee] text-white text-sm font-bold shadow-lg shadow-[#2b8cee]/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2"
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
          </div>
        </div>

        {/* 토스트 메시지 */}
      {success && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
            <span className="material-symbols-outlined">check_circle</span>
            <span className="text-sm font-medium">프로필이 업데이트되었습니다</span>
            <button onClick={() => setSuccess(false)} className="ml-2 hover:opacity-80">
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
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      )}
    </StudentLayout>
  );
}
