// 학습 통계 페이지 (student-statics 샘플 기반)

import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import StudentLayout from '../../components/common/StudentLayout';
import KPICards from '../../components/student/stats/KPICards';
import WeeklySummary from '../../components/student/stats/WeeklySummary';
import LearningTrendChart from '../../components/student/stats/LearningTrendChart';
import ActivityDistributionChart from '../../components/student/stats/ActivityDistributionChart';
import RecentChats from '../../components/student/stats/RecentChats';
import { getSessionHistory } from '../../api/sessions';
import { getDailyStats, getWeeklyStats } from '../../api/stats';
import { mapBackendToReduxStats } from '../../utils/statsSync';

// 시간 포맷 유틸: ms를 "X분 Y초" 형태로 변환
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}초`;
  }
  if (seconds === 0) {
    return `${minutes}분`;
  }
  return `${minutes}분 ${seconds}초`;
}

function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function Banner({ tone = 'info', title, children }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
      : tone === 'warning'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200'
        : 'border-primary/20 bg-primary/10 text-[#111418] dark:text-white';

  return (
    <div className={clsx('rounded-xl border px-4 py-3', styles)}>
      {title ? <p className="text-sm font-bold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

function extractApiData(res) {
  if (!res) return null;
  if (res?.data != null && typeof res.data === 'object') return res.data;
  if (res?.success != null && res?.data != null) return res.data;
  return res;
}

export default function StatsPage() {
  const user = useSelector((state) => state.auth.user);
  const reduxDailyStats = useSelector((state) => state.speakingStats.dailyStats);

  const [activeTab, setActiveTab] = useState('overview');

  // backend stats
  const [dailyStatsApi, setDailyStatsApi] = useState(null);
  const [weeklyStatsApi, setWeeklyStatsApi] = useState(null); // array or object
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // 최근 AI 대화 이력
  const [recentChats, setRecentChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState(null);

  // Fetch backend stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.email) return;
      try {
        setStatsLoading(true);
        setStatsError(null);

        const [dailyRes, weeklyRes] = await Promise.all([
          getDailyStats(user.email),
          getWeeklyStats(user.email),
        ]);

        const dailyData = extractApiData(dailyRes);
        const weeklyData = extractApiData(weeklyRes);

        // daily: try mapping if already in backend shape (camelCase expected)
        const mappedDaily =
          dailyData && typeof dailyData === 'object' ? mapBackendToReduxStats(dailyData) : null;

        setDailyStatsApi(mappedDaily);
        setWeeklyStatsApi(weeklyData);
      } catch (e) {
        console.error('[StatsPage] Failed to fetch stats:', e);
        setStatsError(e?.message || '통계 데이터를 불러오지 못했습니다.');
        setDailyStatsApi(null);
        setWeeklyStatsApi(null);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchStats();
  }, [user?.email]);

  const dailyStats = dailyStatsApi || reduxDailyStats;

  const weeklyList = useMemo(() => {
    const week = weeklyStatsApi;
    // 예상: { stats: [...] } or [...] or { data: [...] }
    const arr =
      Array.isArray(week)
        ? week
        : Array.isArray(week?.stats)
          ? week.stats
          : Array.isArray(week?.days)
            ? week.days
            : Array.isArray(week?.data)
              ? week.data
              : null;

    if (arr && arr.length > 0) {
      // map each entry to redux dailyStats-like shape if possible
      return arr.map((d) => {
        if (!d || typeof d !== 'object') return mapBackendToReduxStats({});
        // if already in camelCase dailyStat
        if (d.totalRecordingTime != null || d.totalSpeakingTime != null) return mapBackendToReduxStats(d);
        // if snake_case
        const camel = {
          date: d.date || d.day || d.dayName,
          totalRecordingTime: d.total_recording_time,
          totalSpeakingTime: d.total_speaking_time,
          sessionsCount: d.sessions_count,
          practiceCount: d.practice_count,
          chatTurnsCount: d.chat_turns_count,
          avgPaceRatio: d.avg_pace_ratio,
          avgNetSpeakingDensity: d.avg_net_speaking_density,
          avgResponseQuality: d.avg_response_quality,
          avgResponseLatency: d.avg_response_latency,
        };
        return mapBackendToReduxStats(camel);
      });
    }

    // fallback: only today
    return [dailyStats];
  }, [weeklyStatsApi, dailyStats]);

  // Redux 데이터로부터 통계 계산
  const kpiData = useMemo(() => {
    const totalRecordingMs = weeklyList.reduce((acc, d) => acc + (d?.totalRecordingTime || 0), 0);
    const totalSpeakingMs = weeklyList.reduce((acc, d) => acc + (d?.totalSpeakingTime || 0), 0);
    const practiceCount = weeklyList.reduce((acc, d) => acc + (d?.practiceCount || 0), 0);
    const chatTurns = weeklyList.reduce((acc, d) => acc + (d?.chatTurnsCount || 0), 0);

    const avgQuality =
      weeklyList.length > 0
        ? weeklyList.reduce((acc, d) => acc + (Number(d?.avgResponseQuality) || 0), 0) / weeklyList.length
        : 0;

    return {
      totalTime: { value: formatTime(totalRecordingMs), change: 0, unit: '' },
      conversations: { value: chatTurns, change: 0, unit: '' },
      streak: { value: '0 Days', change: 0, unit: '' },
      confidence: { value: `${avgQuality ? avgQuality.toFixed(1) : '0.0'}점`, change: 0, unit: '' },
      speakingTime: { value: formatTime(totalSpeakingMs), change: 0, unit: '' },
      practiceCount: { value: practiceCount, change: 0, unit: '회' },
    };
  }, [weeklyList]);

  const weeklySummary = useMemo(() => {
    const speakingRatio = dailyStats.totalRecordingTime > 0
      ? Math.round((dailyStats.totalSpeakingTime / dailyStats.totalRecordingTime) * 100)
      : 0;

    return {
      speakingRatio,
      avgQuality: dailyStats.avgResponseQuality > 0
        ? dailyStats.avgResponseQuality.toFixed(1)
        : '0.0',
      tutorFeedbacks: 0, // TODO: 튜터 피드백 기능 추가 시 연동
      paceRatio: dailyStats.avgPaceRatio > 0
        ? dailyStats.avgPaceRatio.toFixed(2)
        : '0.00',
      totalMinutes: formatTime(dailyStats.totalRecordingTime),
      totalSessions: dailyStats.sessionsCount,
    };
  }, [dailyStats]);

  // 주간 추이 데이터 (백엔드 weekly 우선)
  const weeklyTrendData = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const withDate = (d) => {
      const date = d?.date ? new Date(d.date) : null;
      if (!date || Number.isNaN(date.getTime())) return null;
      return { ...d, __date: date };
    };

    const enriched = weeklyList.map(withDate).filter(Boolean);
    const sorted = enriched.length > 0 ? enriched.sort((a, b) => a.__date - b.__date) : [];

    // ensure 7 points
    const base = sorted.slice(-7);
    if (base.length === 0) {
      const today = new Date();
      return Array.from({ length: 7 }, (_, i) => {
        const dayIndex = (today.getDay() - 6 + i + 7) % 7;
        return { name: dayNames[dayIndex], speaking: 0, listening: 0, practice: 0 };
      });
    }

    return base.map((d) => {
      const dayIndex = d.__date.getDay();
      return {
        name: dayNames[dayIndex],
        speaking: Math.floor((d.totalSpeakingTime || 0) / 60000),
        listening: 0,
        practice: d.practiceCount || 0,
      };
    });
  }, [weeklyList]);

  // 활동 분포 데이터
  const activityDistributionData = useMemo(() => {
    const total = dailyStats.practiceCount + dailyStats.chatTurnsCount;
    if (total === 0) {
      return [
        { name: '데이터 없음', value: 1, color: '#e5e7eb' },
      ];
    }

    const practicePercent = Math.round((dailyStats.practiceCount / total) * 100);
    const chatPercent = Math.round((dailyStats.chatTurnsCount / total) * 100);

    return [
      { name: '문장 연습', value: practicePercent, color: '#6366f1' },
      { name: 'AI 대화', value: chatPercent, color: '#22c55e' },
    ];
  }, [dailyStats]);

  // 최근 AI 대화 조회
  useEffect(() => {
    const fetchRecentChats = async () => {
      if (!user?.email) return;

      try {
        setChatsLoading(true);
        setChatsError(null);

        const result = await getSessionHistory(user.email, 20); // 여유있게 20개 조회

        // AI 채팅 세션만 필터링
        const aiChatSessions = (result?.sessions || [])
          .filter(session => session.sessionType === 'ai_chat')
          .slice(0, 10); // 최근 10개만

        setRecentChats(aiChatSessions);
      } catch (error) {
        console.error('Failed to fetch recent chats:', error);
        setChatsError(error.message || '대화 기록을 불러오지 못했습니다.');
      } finally {
        setChatsLoading(false);
      }
    };

    fetchRecentChats();
  }, [user?.email]);

  return (
    <StudentLayout
      mode="session"
      sessionHeader={
        <header className="flex items-center justify-between bg-white dark:bg-[#1a242f] border-b border-[#dbe0e6] dark:border-gray-800 px-4 md:px-8 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black tracking-tight">Learning Statistics & Analytics</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <button
              type="button"
              className="hidden sm:flex bg-background-light dark:bg-gray-800 rounded-lg px-3 py-1.5 items-center gap-2 border border-[#dbe0e6] dark:border-gray-700"
              title="기간(준비중)"
            >
              <span className="material-symbols-outlined text-sm">calendar_today</span>
              <span className="text-xs font-semibold">Last 30 Days</span>
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            <button
              type="button"
              className="flex items-center justify-center rounded-lg h-10 w-10 bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 relative"
              title="알림(준비중)"
            >
              <span className="material-symbols-outlined">notifications</span>
              <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-800"></span>
            </button>
          </div>
        </header>
      }
    >
      <div className="-mx-4 -mt-8 p-4 md:p-8 pb-14 space-y-8 max-w-[1600px] w-full">
        {/* breadcrumb + tabs */}
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-[#617589] dark:text-gray-400 font-semibold">Home</span>
            <span className="text-[#617589] dark:text-gray-400">/</span>
            <span className="text-[#111418] dark:text-white font-semibold">Learning Statistics</span>
          </div>

          <div className="border-b border-[#dbe0e6] dark:border-gray-800 flex gap-6 md:gap-8 overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'fluency', label: 'Fluency' },
              { key: 'vocabulary', label: 'Vocabulary' },
              { key: 'pronunciation', label: 'Pronunciation' },
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={clsx(
                    'pb-3 font-black text-sm tracking-wide border-b-2 transition-colors whitespace-nowrap',
                    active
                      ? 'border-primary text-primary'
                      : 'border-transparent text-[#617589] dark:text-gray-400 hover:text-primary'
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {statsError ? <Banner tone="warning" title="통계 로딩 실패">{statsError}</Banner> : null}
        {statsLoading ? (
          <Banner title="통계 불러오는 중...">
            <div className="flex items-center gap-2">
              <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="text-sm font-semibold">잠시만 기다려주세요.</p>
            </div>
          </Banner>
        ) : null}

        {/* KPI row (sample-like) */}
        <KPICards kpiData={kpiData} variant="statics" />

        {/* Overview content only (others are UI only for now) */}
        {activeTab !== 'overview' ? (
          <Banner title="준비중">
            <p className="text-sm opacity-90">현재는 Overview만 제공됩니다.</p>
          </Banner>
        ) : null}

        <div
          className={clsx(
            activeTab !== 'overview' ? 'opacity-40 pointer-events-none' : '',
            'flex flex-col gap-6'
          )}
        >
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <LearningTrendChart weeklyData={weeklyTrendData} variant="statics" />
            </div>
            <div>
              <ActivityDistributionChart data={activityDistributionData} variant="statics" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <WeeklySummary weeklySummary={weeklySummary} variant="statics" />
          </div>

          {/* 최근 AI 대화 */}
          <div>
            {chatsLoading ? (
              <div className="rounded-xl p-6 bg-white dark:bg-[#1a242f] border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                  <p className="text-sm font-semibold text-[#111418] dark:text-white">대화 기록 로딩 중...</p>
                </div>
              </div>
            ) : chatsError ? (
              <Banner tone="warning" title="최근 대화">{chatsError}</Banner>
            ) : (
              <RecentChats chats={recentChats} variant="statics" />
            )}
          </div>
        </div>
      </div>
    </StudentLayout>
  );
}
