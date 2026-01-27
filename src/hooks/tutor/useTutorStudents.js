import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ws from '../../config/webSocketConfig';
import { getDashboard } from "../../api/useDashboardData.js";
import { getWeeklyStats } from "../../api/stats.js";
import { setStudentWeeklyStats } from '../../store/slices/tutorStatsSlice';

/**
 * 튜터 학생 목록 관리 훅
 * - 승인된 학생 목록 조회
 * - WebSocket 실시간 학생 상태 업데이트
 */
export default function useTutorStudents() {
  const dispatch = useDispatch();
  const user = useSelector(state => state.auth.user);
  const weeklyStatsByStudent = useSelector(state => state.tutorStats?.studentsWeeklyStats || {});
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [summary, setSummary] = useState({ total: 0, active: 0, speaking: 0, warning: 0 });
  const [wsStatus, setWsStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);

  // 주간 통계 로드 여부 (1회만)
  const weeklyStatsLoadedRef = useRef(false);

  // 승인된 학생 목록 불러오기
  const loadStudents = useCallback(async (isRefresh = false) => {
    if (!user?.email) return;

    try {
      // 초기 로딩만 표시, 폴링 시에는 표시 안 함
      if (!isRefresh) setLoadingStudents(true);

      const response = await getDashboard(user.email);
      let studentList = response.students || [];
      const todayKey = new Date().toISOString().split('T')[0];

      // 주간 통계 1회만 로드 (초기 로드 시)
      if (!weeklyStatsLoadedRef.current && studentList.length > 0) {
        weeklyStatsLoadedRef.current = true;

        // 캐시가 충분하면(오늘 기준) 주간 통계 API 재호출 없이 사용
        const studentsWithStats = await Promise.all(
          studentList.map(async (student) => {
            try {
              const cached = weeklyStatsByStudent?.[student.email];
              if (cached?.data && cached?.fetchedDate === todayKey) {
                const activeDays = cached.data?.summary?.active_days ?? 7;
                return { ...student, activeDays, warning: activeDays < 3 };
              }

              // 캐시가 없으면 조회 후 저장
              const weeklyRes = await getWeeklyStats(student.email);
              const weeklyData =
                weeklyRes?.data && typeof weeklyRes.data === 'object' ? weeklyRes.data : weeklyRes;
              dispatch(setStudentWeeklyStats({ email: student.email, data: weeklyData }));
              const activeDays = weeklyData?.summary?.active_days ?? 7;
              return { ...student, activeDays, warning: activeDays < 3 };
            } catch {
              return { ...student, activeDays: 7, warning: false };
            }
          })
        );
        studentList = studentsWithStats;
      } else if (weeklyStatsLoadedRef.current) {
        // 폴링 시에는 기존 activeDays/warning 유지
        setStudents(prev => {
          return studentList.map(newStudent => {
            const existing = prev.find(s => s.email === newStudent.email);
            if (existing) {
              return { ...newStudent, activeDays: existing.activeDays, warning: existing.warning };
            }
            return { ...newStudent, activeDays: 7, warning: false };
          });
        });
        setSummary(response.summary || { total: 0, active: 0, speaking: 0, warning: 0 });
        console.log("✅ Dashboard 로드 완료");
        return; // early return to avoid duplicate setStudents
      }

      setStudents(studentList);
      setSummary(response.summary || { total: 0, active: 0, speaking: 0, warning: 0 });

      console.log("✅ Dashboard 로드 완료");
    } catch (error) {
      console.error('❌ Dashboard 로드 실패:', error);
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, [user?.email, dispatch, weeklyStatsByStudent]);

  // WebSocket 메시지 핸들러 - 대시보드 업데이트
  const handleWebSocketMessage = useCallback((data) => {
    if (data.type === 'dashboard_update') {
      setStudents((prev) => {
        const nextList = data.students || [];
        return nextList.map((s) => {
          const existing = prev.find((p) => p.email === s.email);
          if (existing?.activeDays != null) {
            return { ...s, activeDays: existing.activeDays, warning: existing.warning };
          }

          const cachedWeekly = weeklyStatsByStudent?.[s.email]?.data;
          const activeDaysFromCache = cachedWeekly?.summary?.active_days;
          if (activeDaysFromCache != null) {
            const activeDays = activeDaysFromCache ?? 7;
            return { ...s, activeDays, warning: activeDays < 3 };
          }

          return { ...s, activeDays: 7, warning: false };
        });
      });
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
  }, [weeklyStatsByStudent]);

  // 초기 로드 + 1분마다 폴링
  useEffect(() => {
    loadStudents(false); // 초기 로드

    const interval = setInterval(() => loadStudents(true), 60 * 1000); // 폴링은 isRefresh=true

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
  const warningStudents = students.filter(s => s.warning || (s.activeDays != null && s.activeDays < 3));

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