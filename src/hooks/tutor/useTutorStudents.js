import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
import { getMyStudents } from '../../api/tutor';

/**
 * 튜터 학생 목록 관리 훅
 * - 승인된 학생 목록 조회
 * - WebSocket 실시간 학생 상태 업데이트
 */
export default function useTutorStudents() {
  const user = useSelector(state => state.auth.user);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [summary, setSummary] = useState({ total: 0, active: 0, speaking: 0, warning: 0 });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);

  // 승인된 학생 목록 불러오기
  const loadStudents = useCallback(async () => {
    try {
      setLoadingStudents(true);
      const response = await getMyStudents();
      
      const studentList = response.data?.students || response.students || [];
      
      const formattedStudents = studentList.map(s => ({
        email: s.studentEmail || s.student_email || s.email,
        name: s.studentName || s.student_name || s.name || '이름 없음',
        activity: null,
        status: 'inactive',
        speakingRatio: 0,
        duration: 0,
        currentSentence: '',
        assignedAt: s.assignedAt || s.assigned_at,
      }));
      
      setStudents(formattedStudents);
    } catch (error) {
      console.error('학생 목록 로드 실패:', error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  // WebSocket 메시지 핸들러 - 대시보드 업데이트
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'dashboard_update') {
      setStudents(data.students || []);
      setSummary(data.summary || { total: 0, active: 0, speaking: 0, warning: 0 });
      setLastUpdate(new Date(data.timestamp));
      console.log('✅ 대시보드 업데이트 완료:', data.students?.length, '명');
    }
    // 학생 추가 알림 수신 시 목록에 즉시 추가
    else if (data.type === 'STUDENT_ADDED') {
      const newStudent = {
        email: data.data?.student_email,
        name: data.data?.student_name || '이름 없음',
        activity: null,
        status: 'inactive',
        speakingRatio: 0,
        duration: 0,
        currentSentence: '',
        assignedAt: data.data?.assigned_at,
      };
      setStudents(prev => {
        // 이미 있는 학생인지 확인
        if (prev.some(s => s.email === newStudent.email)) {
          return prev;
        }
        return [...prev, newStudent];
      });
      console.log('✅ 새 학생 추가됨:', newStudent.name);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // WebSocket 리스너 등록 (user?.email이 있을 때만)
  useEffect(() => {
    if (user?.email) {
      ws.connect();
      setWsStatus('connected');
      const unsubscribe = ws.addMessageListener(handleWebSocketMessage);
      return () => unsubscribe();
    }
  }, [user?.email, handleWebSocketMessage]);

  // 파생 데이터
  const activeStudents = students.filter(s => s.status !== 'inactive');
  const speakingStudents = students.filter(s => s.status === 'speaking');
  const warningStudents = students.filter(s => s.warning || s.alert);

  return {
    students,
    loadingStudents,
    summary,
    wsStatus,
    lastUpdate,
    activeStudents,
    speakingStudents,
    warningStudents,
    refreshStudents: loadStudents,
  };
}
