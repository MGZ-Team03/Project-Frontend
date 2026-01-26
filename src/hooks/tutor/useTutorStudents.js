import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
import { getDashboard } from "../../api/useDashboardData.js";

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
    if (!user?.email) return; // ✨ 추가: early return

    try {
      setLoadingStudents(true);
      const response = await getDashboard(user.email); // ⚠️ response로 받았는데

      setStudents(response.students || []); // ⚠️ 수정: data → response
      setSummary(response.summary || { total: 0, active: 0, speaking: 0, warning: 0 }); // ⚠️ 수정: data → response

      console.log("✅ Dashboard 로드 완료"); // ✨ 추가: 성공 로그
    } catch (error) {
      console.error('❌ Dashboard 로드 실패:', error); // 🔄 수정: 로그 메시지
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [user?.email]);

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

  // 초기 로드 + 1분마다 폴링
  useEffect(() => {
    loadStudents();

    const interval = setInterval(loadStudents, 60 * 1000);

    return () => clearInterval(interval);
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