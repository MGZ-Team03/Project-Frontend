import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentLayout from '../../components/common/StudentLayout';
import useProfileForm from '../../hooks/useProfileForm';
import ProfileImageSection from '../../components/profile/ProfileImageSection';
import ProfileToast from '../../components/profile/ProfileToast';
import ReadOnlyField from '../../components/profile/ReadOnlyField';
import ProfileFormActions from '../../components/profile/ProfileFormActions';
import { getAiLevel } from '../../api/aiLevel';

const THEME_COLOR = '#2b8cee';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [aiLevelOverride, setAiLevelOverride] = useState('');
  const [aiLevelLoading, setAiLevelLoading] = useState(false);
  const [aiLevelError, setAiLevelError] = useState(false);
  const [aiLevelRefreshBlocked, setAiLevelRefreshBlocked] = useState(false);
  
  const {
    user,
    form,
    setForm,
    displayImage,
    hasChanges,
    uploading,
    loading,
    success,
    error,
    pendingImageFile,
    fileInputRef,
    handleImageChange,
    handleRemoveImage,
    handleSubmit,
    setSuccess,
    setError,
  } = useProfileForm();

  // user.learningLevel이 기본값이고, 새로고침 버튼으로만 서버 평가 요청
  useEffect(() => {
    // 유저가 바뀌면(로그인 변경/리프레시) 에러/override 초기화
    setAiLevelOverride('');
    setAiLevelError(false);
    setAiLevelLoading(false);
    setAiLevelRefreshBlocked(false);
  }, [user?.email]);

  const handleRefreshAiLevel = async () => {
    setAiLevelLoading(true);
    setAiLevelError(false);

    try {
      const { success: ok, level } = await getAiLevel();
      if (ok && level) {
        setAiLevelOverride(level);
      } else {
        // 서버 응답은 왔지만 success=false (또는 level 비어있음)인 경우: 버튼 비활성화
        setAiLevelError(true);
        setAiLevelRefreshBlocked(true);
      }
    } catch (e) {
      setAiLevelError(true);
    } finally {
      setAiLevelLoading(false);
    }
  };

  const getAiLevelValue = () => {
    const baseLevel = user?.learningLevel;
    const level = aiLevelOverride || baseLevel;
    if (level) return level;
    return '';
  };

  return (
    <StudentLayout>
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white dark:bg-[#1a202c] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d3748] overflow-hidden">
          <div className="border-b border-slate-100 dark:border-[#2d3748] p-8">
            <h3 className="text-2xl font-black text-[#111418] dark:text-white tracking-tight">프로필 설정</h3>
            <p className="text-slate-500 dark:text-[#a0aec0] mt-1">개인 정보를 업데이트하세요.</p>
          </div>

          <div className="p-8 space-y-8">
            <ProfileImageSection
              displayImage={displayImage}
              userName={user?.name}
              uploading={uploading}
              loading={loading}
              pendingImageFile={pendingImageFile}
              fileInputRef={fileInputRef}
              onImageChange={handleImageChange}
              onRemoveImage={handleRemoveImage}
              themeColor={THEME_COLOR}
            />

            <form onSubmit={handleSubmit} className="space-y-6">
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

              <ReadOnlyField
                label="이메일"
                value={user?.email || ''}
              />

              <ReadOnlyField
                label="학습 레벨 (AI 분석)"
                value={getAiLevelValue()}
                description={
                  aiLevelError
                    ? '학습 레벨 평가 요청에 실패했습니다. 하루에 한 번만 시도해주세요.'
                    : (user?.learningLevel || aiLevelOverride)
                        ? ''
                        : '학습 레벨이 아직 없습니다. 오른쪽 버튼을 눌러 레벨 평가를 요청하세요.'
                }
                descriptionClassName={
                  aiLevelError || (!user?.learningLevel && !aiLevelOverride)
                    ? 'text-red-600 dark:text-red-400'
                    : ''
                }
                inputClassName={aiLevelError ? 'border-red-200 dark:border-red-500/40' : ''}
                endAdornment={
                  <button
                    type="button"
                    onClick={handleRefreshAiLevel}
                    disabled={aiLevelLoading || aiLevelRefreshBlocked}
                    aria-label="학습 레벨 새로고침"
                    className={[
                      'inline-flex items-center justify-center w-9 h-9 rounded-md',
                      'text-slate-500 dark:text-slate-400 hover:text-[#2b8cee] hover:bg-[#2b8cee]/10',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    ].join(' ')}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {aiLevelLoading ? 'progress_activity' : 'refresh'}
                    </span>
                  </button>
                }
              />

              <div className="bg-[#2b8cee]/5 dark:bg-[#2b8cee]/10 border border-[#2b8cee]/20 rounded-xl p-4 flex gap-4">
                <span className="material-symbols-outlined text-[#2b8cee]">auto_awesome</span>
                <p className="text-sm text-slate-600 dark:text-[#a0aec0]">
                  <strong className="text-[#111418] dark:text-white">AI 안내:</strong>{' '}
                  학습 레벨은 최근 10개의 AI 대화로 당신의 영어실력을 평가합니다.
                </p>
              </div>
            </form>
          </div>

          <ProfileFormActions
            onCancel={() => navigate('/home')}
            onSubmit={handleSubmit}
            loading={loading}
            uploading={uploading}
            hasChanges={hasChanges}
            themeColor={THEME_COLOR}
          />
        </div>
      </div>

      <ProfileToast
        success={success}
        error={error}
        onSuccessClose={() => setSuccess(false)}
        onErrorClose={() => setError(null)}
      />
    </StudentLayout>
  );
}
