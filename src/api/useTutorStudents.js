import { useState, useEffect } from 'react';
import api from './axios';

/**
 * 튜터의 담당 학생 목록 조회 Hook
 * @returns {Object} { students, loading, error, refetch }
 */
export const useTutorStudents = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/api/tutor/students');
      
      if (response.data.success) {
        // API 응답의 studentName을 name으로 매핑
        const mappedStudents = response.data.data.students.map(student => ({
          ...student,
          name: student.studentName || student.name,
          email: student.studentEmail || student.email,
        }));
        setStudents(mappedStudents);
      } else {
        throw new Error('학생 목록 조회 실패');
      }
    } catch (err) {
      console.error('학생 목록 조회 에러:', err);
      setError(err.message || '학생 목록을 불러오는데 실패했습니다.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return {
    students,
    loading,
    error,
    refetch: fetchStudents
  };
};

/**
 * 학생 목록 조회 함수 (Hook 없이 사용)
 * @returns {Promise<Array>} 학생 목록
 */
export const getTutorStudents = async () => {
  try {
    const response = await api.get('/api/tutor/students');
    
    if (response.data.success) {
      // API 응답의 studentName을 name으로 매핑
      return response.data.data.students.map(student => ({
        ...student,
        name: student.studentName || student.name,
        email: student.studentEmail || student.email,
      }));
    }
    throw new Error('학생 목록 조회 실패');
  } catch (error) {
    console.error('학생 목록 조회 에러:', error);
    throw error;
  }
};
