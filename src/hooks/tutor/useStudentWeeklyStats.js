import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getWeeklyStats } from '../../api/stats';
import { setStudentWeeklyStats } from '../../store/slices/tutorStatsSlice';

/**
 * 학생 주간 통계 데이터 관리
 */
export default function useStudentWeeklyStats(email) {
  const dispatch = useDispatch();
  
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const weeklyCacheEntry = useSelector((state) => 
    email ? state.tutorStats?.studentsWeeklyStats?.[email] : null
  );
  const weeklyStats = weeklyCacheEntry?.data || null;
  const shouldFetchWeekly = Boolean(email) && 
    (!weeklyStats || weeklyCacheEntry?.fetchedDate !== todayStr);

  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyError, setWeeklyError] = useState(null);

  useEffect(() => {
    const fetchWeekly = async () => {
      if (!email || !shouldFetchWeekly) return;
      try {
        setWeeklyLoading(true);
        setWeeklyError(null);
        const weeklyRes = await getWeeklyStats(email);
        const weeklyData =
          weeklyRes?.data && typeof weeklyRes.data === 'object' ? weeklyRes.data : weeklyRes;
        dispatch(setStudentWeeklyStats({ email, data: weeklyData }));
      } catch (e) {
        console.error('[useStudentWeeklyStats] Failed to fetch weekly stats:', e);
        setWeeklyError(e?.message || '주간 통계를 불러오지 못했습니다.');
      } finally {
        setWeeklyLoading(false);
      }
    };

    fetchWeekly();
  }, [email, shouldFetchWeekly, dispatch]);

  const weeklySummary = useMemo(() => {
    const summary = weeklyStats?.summary;
    if (!summary) return null;

    return {
      totalRecordingTime: summary.total_recording_time || 0,
      totalSpeakingTime: summary.total_speaking_time || 0,
      practiceCount: summary.total_practice_count || 0,
      chatTurnsCount: summary.total_chat_turns || 0,
      speakingRatio: Math.round(summary.avg_net_speaking_density || 0),
      avgQuality: (summary.avg_response_quality || 0).toFixed(1),
      paceRatio: (summary.avg_pace_ratio || 0).toFixed(2),
    };
  }, [weeklyStats]);

  const weeklyTrendData = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();

    const toLocalDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return toLocalDateStr(d);
    });

    const dataByDate = {};
    (weeklyStats?.daily || []).forEach((d) => {
      if (d?.date) dataByDate[d.date] = d;
    });

    return last7Days.map((dateStr, idx) => {
      const d = dataByDate[dateStr];
      const dateObj = new Date(today);
      dateObj.setDate(dateObj.getDate() - (6 - idx));
      const dayIndex = dateObj.getDay();

      return {
        name: dayNames[dayIndex],
        speakingSec: Math.max(0, Math.round((d?.total_speaking_time || 0) / 1000)),
        listening: 0,
        practice: d?.practice_count || 0,
        chatTurns: d?.chat_turns_count || 0,
      };
    });
  }, [weeklyStats]);

  return {
    weeklyStats,
    weeklySummary,
    weeklyTrendData,
    weeklyLoading,
    weeklyError,
  };
}
