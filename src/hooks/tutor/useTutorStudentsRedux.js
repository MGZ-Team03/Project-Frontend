import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../../api/axios';
import { setLoading, setStudents, setError } from '../../store/slices/tutorStudentsSlice';

/**
 * 튜터 학생 목록 관리 (Redux 연동 - DashboardPage 전용)
 * API 호출 + Redux 저장
 */
export default function useTutorStudentsRedux() {
  const dispatch = useDispatch();
  
  // Redux에서 상태 읽기
  const students = useSelector(state => state.tutorStudents.students);
  const loading = useSelector(state => state.tutorStudents.loading);
  const error = useSelector(state => state.tutorStudents.error);
  const lastUpdate = useSelector(state => state.tutorStudents.lastUpdate);

  // API 호출 및 Redux 저장
  const fetchStudents = useCallback(async () => {
    try {
      dispatch(setLoading(true));
      
      const response = await api.get('/api/tutor/students');
      
      if (response.data.success) {
        // API 응답의 studentName을 name으로 매핑
        const mappedStudents = response.data.data.students.map(student => ({
          ...student,
          name: student.studentName || student.name,
          email: student.studentEmail || student.email,
        }));
        
        dispatch(setStudents(mappedStudents));
      } else {
        throw new Error('학생 목록 조회 실패');
      }
    } catch (err) {
      console.error('학생 목록 조회 에러:', err);
      dispatch(setError(err.message || '학생 목록을 불러오는데 실패했습니다.'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // 초기 로드
  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // 60초 폴링
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStudents();
    }, 60000); // 60초

    return () => clearInterval(interval);
  }, [fetchStudents]);

  return {
    students,
    loading,
    error,
    lastUpdate,
    refetch: fetchStudents,
  };
}
