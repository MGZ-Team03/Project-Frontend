// 튜터 - 학생 상세 페이지 (Tailwind CSS)

import { useParams } from 'react-router-dom';
import TutorLayout from '../../components/common/TutorLayout';
import FeedbackNotification from '../../components/tutor/FeedbackNotification';
import StudentProfileHeader from '../../components/tutor/StudentProfileHeader';
import FeedbackPanel from '../../components/tutor/FeedbackPanel';
import WeeklySummary from '../../components/student/stats/WeeklySummary';
import LearningTrendChart from '../../components/student/stats/LearningTrendChart';
import useStudentDetail from '../../hooks/tutor/useStudentDetail';
import useStudentWeeklyStats from '../../hooks/tutor/useStudentWeeklyStats';
import useStudentFeedbackHistory from '../../hooks/tutor/useStudentFeedbackHistory';
import useStudentFeedback from '../../hooks/tutor/useStudentFeedback';

export default function StudentDetailPage() {
  const { email } = useParams();

  // 커스텀 훅 사용
  const { 
    student, 
    students, 
    studentName, 
    studentStatus,
    studentActivity,
    activityBadge, 
    loadingStudents,
    tutorEmail,
  } = useStudentDetail(email);

  const {
    weeklySummary,
    weeklyTrendData,
    weeklyLoading,
    weeklyError,
  } = useStudentWeeklyStats(email);

  const {
    feedbackHistory,
    feedbackLoading,
    addFeedback,
  } = useStudentFeedbackHistory(email);

  const {
    feedbackText,
    setFeedbackText,
    sending,
    notification,
    handleSendFeedback,
    handleQuickFeedback,
    handleTTSFeedback,
    closeNotification,
  } = useStudentFeedback({
    tutorEmail,
    studentEmail: email,
    onFeedbackSent: addFeedback,
  });

  return (
    <TutorLayout
      title="Student Profile Details"
      subtitle="SpeakTracker Tutor Portal"
      studentCount={students.length}
    >
      {/* 메인 레이아웃: 좌측 콘텐츠 + 우측 피드백 패널 */}
      <div className="flex gap-6 items-start">
        {/* 왼쪽: 메인 콘텐츠 */}
        <div className="flex-1 space-y-6 min-w-0">
          <StudentProfileHeader 
            student={student}
            email={email}
            activityBadge={activityBadge}
            loadingStudents={loadingStudents}
          />

          {weeklyError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 px-4 py-3">
              <p className="text-sm font-bold">주간 통계 로딩 실패</p>
              <p className="text-sm mt-1">{weeklyError}</p>
            </div>
          ) : null}

          {weeklyLoading ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#137fec]/30 border-t-[#137fec]" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">주간 통계 불러오는 중...</p>
              </div>
            </div>
          ) : null}

          {weeklySummary ? (
            <WeeklySummary weeklySummary={weeklySummary} />
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                이번 주 요약 데이터가 없습니다.
              </p>
            </div>
          )}

          <LearningTrendChart weeklyData={weeklyTrendData} />
        </div>

        <FeedbackPanel 
          studentName={studentName}
          studentStatus={studentStatus}
          studentActivity={studentActivity}
          feedbackHistory={feedbackHistory}
          feedbackLoading={feedbackLoading}
          feedbackText={feedbackText}
          setFeedbackText={setFeedbackText}
          sending={sending}
          onSendFeedback={handleSendFeedback}
          onTTSFeedback={handleTTSFeedback}
          onQuickFeedback={handleQuickFeedback}
        />
      </div>

      {/* 알림 */}
      <FeedbackNotification
        notification={notification}
        onClose={closeNotification}
      />
    </TutorLayout>
  );
}
