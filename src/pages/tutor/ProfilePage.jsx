import { useNavigate } from 'react-router-dom';
import TutorLayout from '../../components/common/TutorLayout';
import useProfileForm from '../../hooks/useProfileForm';
import ProfileImageSection from '../../components/profile/ProfileImageSection';
import ProfileToast from '../../components/profile/ProfileToast';
import ReadOnlyField from '../../components/profile/ReadOnlyField';
import ProfileFormActions from '../../components/profile/ProfileFormActions';

const THEME_COLOR = '#137fec';

export default function TutorProfilePage() {
  const navigate = useNavigate();
  
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

  return (
    <TutorLayout
      title="Profile Settings"
      subtitle="Manage your account"
    >
      <div className="max-w-[600px] mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 p-8">
            <h3 className="text-2xl font-black text-[#111418] dark:text-white tracking-tight">프로필 설정</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">개인 정보를 업데이트하세요.</p>
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
              defaultInitial="T"
            />

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex flex-col gap-2">
                <label className="text-[#111418] dark:text-white text-sm font-semibold">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="이름을 입력하세요"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111418] dark:text-white focus:ring-2 focus:ring-[#137fec]/20 focus:border-[#137fec] transition-all h-12 px-4 text-sm"
                  required
                />
              </div>

              <ReadOnlyField
                label="이메일"
                value={user?.email || ''}
              />

              <ReadOnlyField
                label="역할"
                value="튜터"
              />

              <div className="bg-[#137fec]/5 dark:bg-[#137fec]/10 border border-[#137fec]/20 rounded-xl p-4 flex gap-4">
                <span className="material-symbols-outlined text-[#137fec]">school</span>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  <strong className="text-[#111418] dark:text-white">튜터 안내:</strong>{' '}
                  담당 학생들의 학습 현황을 확인하고 실시간 피드백을 전달할 수 있습니다.
                </p>
              </div>
            </form>
          </div>

          <ProfileFormActions
            onCancel={() => navigate('/tutor/dashboard')}
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
    </TutorLayout>
  );
}
