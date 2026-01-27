import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getStudentStatus } from '../../utils/timeUtils';

/**
 * 학생 상세 정보 및 활동 상태 뱃지 관리 (Redux 읽기 전용)
 */
export default function useStudentDetail(email) {
  // Redux에서 학생 목록 읽기 (읽기 전용)
  const students = useSelector(state => state.tutorStudents.students);
  const loading = useSelector(state => state.tutorStudents.loading);
  
  // 튜터 이메일은 auth에서 가져옴
  const tutorEmail = useSelector(state => state.auth.user?.email);
  
  const student = useMemo(
    () => students.find((s) => s.email === email),
    [students, email]
  );

  // 학생 상태 정보 계산 (room, updated_at 기반)
  const statusInfo = useMemo(() => getStudentStatus(student), [student]);
  
  const studentName = student?.name || '이름 없음';
  const studentStatus = statusInfo.status;
  // activity: 'conversation' | 'sentence' | null
  const studentActivity = statusInfo.status === 'ai' ? 'conversation' 
    : statusInfo.status === 'sentence' ? 'sentence' 
    : null;

  const activityBadge = useMemo(() => {
    if (studentActivity === 'conversation') {
      return {
        label: 'AI 대화',
        icon: 'forum',
        className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      };
    }
    if (studentActivity === 'sentence') {
      return {
        label: '문장 연습',
        icon: 'format_quote',
        className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      };
    }
    if (studentStatus !== 'offline' && studentStatus !== 'inactive') {
      return {
        label: statusInfo.activity || '접속 중',
        icon: 'wifi',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      };
    }
    return {
      label: '오프라인',
      icon: 'cloud_off',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300',
    };
  }, [studentActivity, studentStatus, statusInfo.activity]);

  return {
    student,
    students,
    studentName,
    studentStatus,
    studentActivity,
    activityBadge,
    loadingStudents: loading,
    tutorEmail,
  };
}
