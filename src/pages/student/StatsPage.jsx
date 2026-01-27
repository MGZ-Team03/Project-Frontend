// 학습 통계 페이지 (student-statics 샘플 기반)

import { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setWeeklyStatsCache } from '../../store/slices/speakingStatsSlice';
import StudentLayout from '../../components/common/StudentLayout';
import WeeklySummary from '../../components/student/stats/WeeklySummary';
import LearningTrendChart from '../../components/student/stats/LearningTrendChart';
import ActivityDistributionChart from '../../components/student/stats/ActivityDistributionChart';
import RecentChats from '../../components/student/stats/RecentChats';
import { getDailyStats, getWeeklyStats } from '../../api/stats';
import { getConversationList } from '../../api/conversations';
import { mapBackendToReduxStats } from '../../utils/statsSync';
import {
  getNetSpeakingDensityFeedback,
  getPaceRatioFeedback,
  getResponseQualityFeedback,
} from '../../store/selectors/speakingStatsSelectors';

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
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const reduxDailyStats = useSelector((state) => state.speakingStats.dailyStats);
  const weeklyStatsCache = useSelector((state) => state.speakingStats.weeklyStatsCache);

  // backend stats
  const [dailyStatsApi, setDailyStatsApi] = useState(null);
  const [weeklyStatsApi, setWeeklyStatsApi] = useState(null); // array or object
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // 최근 AI 대화 이력
  const [recentChats, setRecentChats] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState(null);

  // 오늘 날짜 (캐시 유효성 검사용)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 캐시가 오늘 fetch된 것인지 확인
  const shouldFetchWeekly = !weeklyStatsCache?.data || weeklyStatsCache?.fetchedDate !== todayStr;

  // Fetch backend stats (캐시 활용)
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.email) return;
      try {
        setStatsLoading(true);
        setStatsError(null);

        // dailyStats는 항상 fetch (최신 오늘 데이터)
        const dailyRes = await getDailyStats(user.email);
        const dailyData = extractApiData(dailyRes);
        const mappedDaily =
          dailyData && typeof dailyData === 'object' ? mapBackendToReduxStats(dailyData) : null;
        setDailyStatsApi(mappedDaily);

        // weeklyStats는 캐시 있으면 사용, 없으면 fetch
        if (shouldFetchWeekly) {
          const weeklyRes = await getWeeklyStats(user.email);
          const weeklyData = extractApiData(weeklyRes);
          setWeeklyStatsApi(weeklyData);
          // Redux 캐시에 저장
          dispatch(setWeeklyStatsCache(weeklyData));
        } else {
          // 캐시 데이터 사용
          setWeeklyStatsApi(weeklyStatsCache.data);
        }
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
  }, [user?.email, shouldFetchWeekly, dispatch, weeklyStatsCache?.data, todayStr]);

  const useApiDailyStats = useMemo(() => {
    const s = dailyStatsApi;
    if (!s) return false;
    // date만 있고 값이 0이면 Redux(localStorage) 폴백 사용
    return Boolean(
      s.totalRecordingTime > 0 ||
      s.totalSpeakingTime > 0 ||
      s.sessionsCount > 0 ||
      s.practiceCount > 0 ||
      s.chatTurnsCount > 0 ||
      s.paceRatioCount > 0 ||
      s.responseQualityCount > 0 ||
      s.responseLatencyCount > 0
    );
  }, [dailyStatsApi]);

  const dailyStats = useApiDailyStats ? dailyStatsApi : reduxDailyStats;

  // 주간 통계에서 daily 배열과 summary 추출 + delta 계산
  const { dailyList, summary, deltaRecording, deltaSpeaking, deltaPractice, deltaChatTurns } = useMemo(() => {
    const week = weeklyStatsApi;

    // 새 API 응답 구조: { daily: [...], summary: {...} }
    const daily = week?.daily || [];
    const summaryData = week?.summary || {};

    // daily 배열을 Redux 형식으로 매핑 (백엔드 포맷: snake_case)
    const mappedDaily = daily.map((d) => {
      if (!d || typeof d !== 'object') return mapBackendToReduxStats({});

      const camel = {
        date: d.date,
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

    // 오늘 날짜 (YYYY-MM-DD)
    const todayStr = new Date().toISOString().split('T')[0];

    // 백엔드 오늘 데이터 (summary에 이미 포함되어 있음)
    const backendToday = mappedDaily.find((d) => d.date === todayStr) || {};

    // 로컬이 백엔드보다 큰 경우만 차액 계산 (세션 중 아직 동기화 안 된 증가분)
    const dRecording = Math.max(0, (dailyStats?.totalRecordingTime || 0) - (backendToday.totalRecordingTime || 0));
    const dSpeaking = Math.max(0, (dailyStats?.totalSpeakingTime || 0) - (backendToday.totalSpeakingTime || 0));
    const dPractice = Math.max(0, (dailyStats?.practiceCount || 0) - (backendToday.practiceCount || 0));
    const dChatTurns = Math.max(0, (dailyStats?.chatTurnsCount || 0) - (backendToday.chatTurnsCount || 0));

    // dailyStats(로컬)에 유효한 데이터가 있는지 확인
    const hasTodayData = (dailyStats?.totalRecordingTime || 0) > 0 ||
                         (dailyStats?.totalSpeakingTime || 0) > 0 ||
                         (dailyStats?.practiceCount || 0) > 0 ||
                         (dailyStats?.chatTurnsCount || 0) > 0;

    // 백엔드 daily에서 오늘 데이터 제외 + 로컬 오늘 데이터 추가
    let finalDaily = mappedDaily;
    if (mappedDaily.length > 0) {
      // 오늘 날짜 데이터는 백엔드 것 제외 (로컬이 더 최신)
      const withoutToday = mappedDaily.filter((d) => d.date !== todayStr);

      if (hasTodayData) {
        // 로컬 오늘 데이터 추가
        finalDaily = [...withoutToday, { ...dailyStats, date: todayStr }];
      } else {
        finalDaily = withoutToday;
      }
    } else if (hasTodayData) {
      finalDaily = [{ ...dailyStats, date: todayStr }];
    } else {
      finalDaily = [];
    }

    return {
      dailyList: finalDaily,
      summary: summaryData,
      deltaRecording: dRecording,
      deltaSpeaking: dSpeaking,
      deltaPractice: dPractice,
      deltaChatTurns: dChatTurns,
    };
  }, [weeklyStatsApi, dailyStats]);

  const weeklyList = dailyList;

  // summary 우선 사용, 없으면 weeklyList에서 계산
  // summary는 오늘 포함 7일치이므로, 세션 중 아직 동기화 안 된 delta만 추가
  const kpiData = useMemo(() => {
    if (summary && Object.keys(summary).length > 0) {
      return {
        totalTime: { value: formatTime((summary.total_recording_time || 0) + deltaRecording), change: 0, unit: '' },
        conversations: { value: (summary.total_chat_turns || 0) + deltaChatTurns, change: 0, unit: '' },
        activeDays: { value: `${summary.active_days || 0} Days`, change: 0, unit: '' },
        confidence: { value: `${(summary.avg_response_quality || 0).toFixed(1)}점`, change: 0, unit: '' },
        speakingTime: { value: formatTime((summary.total_speaking_time || 0) + deltaSpeaking), change: 0, unit: '' },
        practiceCount: { value: (summary.total_practice_count || 0) + deltaPractice, change: 0, unit: '회' },
      };
    }

    // fallback: weeklyList에서 계산
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
      activeDays: { value: '0 Days', change: 0, unit: '' },
      confidence: { value: `${avgQuality ? avgQuality.toFixed(1) : '0.0'}점`, change: 0, unit: '' },
      speakingTime: { value: formatTime(totalSpeakingMs), change: 0, unit: '' },
      practiceCount: { value: practiceCount, change: 0, unit: '회' },
    };
  }, [weeklyList, summary, deltaRecording, deltaSpeaking, deltaPractice, deltaChatTurns]);

  const weeklySummary = useMemo(() => {
    // 주간 합계 계산 (weeklyList에서)
    const weeklyTotalRecording = weeklyList.reduce((acc, d) => acc + (d?.totalRecordingTime || 0), 0);
    const weeklyTotalSpeaking = weeklyList.reduce((acc, d) => acc + (d?.totalSpeakingTime || 0), 0);
    const weeklyPracticeCount = weeklyList.reduce((acc, d) => acc + (d?.practiceCount || 0), 0);
    const weeklyChatTurns = weeklyList.reduce((acc, d) => acc + (d?.chatTurnsCount || 0), 0);

    // dailyList에서 평균 계산 (summary에 값이 없을 때 사용)
    const calcAvgFromDailyList = (field) => {
      const validItems = dailyList.filter((d) => d[field] > 0);
      if (validItems.length === 0) return 0;
      return validItems.reduce((acc, d) => acc + d[field], 0) / validItems.length;
    };

    // summary 우선 사용 (오늘 포함 7일치 + 세션 중 동기화 안 된 delta만 추가)
    if (summary && Object.keys(summary).length > 0) {
      // summary에 값이 없으면 dailyList에서 계산
      const paceRatioVal = summary.avg_pace_ratio || calcAvgFromDailyList('avgPaceRatio');
      const avgQualityVal = summary.avg_response_quality || calcAvgFromDailyList('avgResponseQuality');
      const speakingRatioVal = summary.avg_net_speaking_density || calcAvgFromDailyList('avgNetSpeakingDensity');

      // summary(오늘 포함) + 세션 중 동기화 안 된 delta만 추가 (중복 방지)
      const totalRecording = (summary.total_recording_time || 0) + deltaRecording;
      const totalSpeaking = (summary.total_speaking_time || 0) + deltaSpeaking;
      const totalPractice = (summary.total_practice_count || 0) + deltaPractice;
      const totalChatTurns = (summary.total_chat_turns || 0) + deltaChatTurns;

      return {
        speakingRatio: Math.round(speakingRatioVal),
        avgQuality: avgQualityVal.toFixed(1),
        paceRatio: paceRatioVal.toFixed(2),
        practiceCount: totalPractice,
        totalRecordingTime: totalRecording,
        totalSpeakingTime: totalSpeaking,
        chatTurnsCount: totalChatTurns,
      };
    }

    // fallback: weeklyList 합계 또는 dailyStats 사용
    const speakingRatio = weeklyTotalRecording > 0
      ? Math.round((weeklyTotalSpeaking / weeklyTotalRecording) * 100)
      : dailyStats.totalRecordingTime > 0
        ? Math.round((dailyStats.totalSpeakingTime / dailyStats.totalRecordingTime) * 100)
        : 0;

    // weeklyList에서 품질 지표 평균 계산
    const weeklyAvgQuality = calcAvgFromDailyList('avgResponseQuality');
    const weeklyAvgPaceRatio = calcAvgFromDailyList('avgPaceRatio');

    return {
      speakingRatio,
      avgQuality: (weeklyAvgQuality || dailyStats.avgResponseQuality || 0).toFixed(1),
      paceRatio: (weeklyAvgPaceRatio || dailyStats.avgPaceRatio || 0).toFixed(2),
      practiceCount: weeklyPracticeCount || dailyStats.practiceCount || 0,
      totalRecordingTime: weeklyTotalRecording || dailyStats.totalRecordingTime || 0,
      totalSpeakingTime: weeklyTotalSpeaking || dailyStats.totalSpeakingTime || 0,
      chatTurnsCount: weeklyChatTurns || dailyStats.chatTurnsCount || 0,
    };
  }, [dailyStats, dailyList, weeklyList, summary, deltaRecording, deltaSpeaking, deltaPractice, deltaChatTurns]);

  const paceRatioValue = Number(dailyStats?.avgPaceRatio || 0) || 0;
  const densityValue = Number(dailyStats?.avgNetSpeakingDensity || 0) || 0;
  const qualityValue = Number(dailyStats?.avgResponseQuality || 0) || 0;

  const paceRatioPresent = Boolean(
    (Number.isFinite(paceRatioValue) && paceRatioValue > 0) || (dailyStats?.paceRatioCount || 0) > 0
  );
  const densityPresent = (dailyStats?.totalRecordingTime || 0) > 0;
  const qualityPresent = Boolean(
    (Number.isFinite(qualityValue) && qualityValue > 0) || (dailyStats?.responseQualityCount || 0) > 0
  );

  const paceFeedback = getPaceRatioFeedback(paceRatioPresent ? paceRatioValue : null);
  const densityFeedback = getNetSpeakingDensityFeedback(densityPresent ? densityValue : null);
  const qualityFeedback = getResponseQualityFeedback(qualityPresent ? qualityValue : null);

  // 주간 추이 데이터 (오늘 포함 7일)
  const weeklyTrendData = useMemo(() => {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const today = new Date();

    // 로컬 타임존 기준 YYYY-MM-DD 포맷 함수
    const toLocalDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    // 오늘 포함 최근 7일 날짜 배열 생성 (6일 전 ~ 오늘)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      return toLocalDateStr(d);
    });

    // weeklyList를 날짜별 맵으로 변환
    const dataByDate = {};
    weeklyList.forEach((d) => {
      if (d?.date) {
        dataByDate[d.date] = d;
      }
    });

    // 7일 데이터 생성 (없는 날짜는 0으로 채움)
    return last7Days.map((dateStr, idx) => {
      const d = dataByDate[dateStr];
      // 로컬 기준 요일 계산
      const dateObj = new Date(today);
      dateObj.setDate(dateObj.getDate() - (6 - idx));
      const dayIndex = dateObj.getDay();

      return {
        name: dayNames[dayIndex],
        speakingSec: Math.max(0, Math.round((d?.totalSpeakingTime || 0) / 1000)),
        listening: 0,
        practice: d?.practiceCount || 0,
        chatTurns: d?.chatTurnsCount || 0,
      };
    });
  }, [weeklyList]);

  // 활동 분포 데이터 (최근 7일 기준)
  const activityDistributionData = useMemo(() => {
    // 주간 summary(오늘 포함 7일) 기준 분포
    const summaryPractice = Number(summary?.total_practice_count || 0) + (deltaPractice || 0);
    const summaryChatTurns = Number(summary?.total_chat_turns || 0) + (deltaChatTurns || 0);
    const summaryTotal = summaryPractice + summaryChatTurns;
    if (summaryTotal > 0) {
      const practicePercent = Math.round((summaryPractice / summaryTotal) * 100);
      const chatPercent = Math.max(0, 100 - practicePercent);
      return [
        { name: '문장 연습', value: practicePercent, color: '#6366f1' },
        { name: 'AI 대화', value: chatPercent, color: '#22c55e' },
      ];
    }

    // fallback: weeklyList에서 합산
    const weeklyPracticeCount = weeklyList.reduce((acc, d) => acc + (d?.practiceCount || 0), 0);
    const weeklyChatTurns = weeklyList.reduce((acc, d) => acc + (d?.chatTurnsCount || 0), 0);
    const totalCount = weeklyPracticeCount + weeklyChatTurns;

    if (totalCount > 0) {
      const practicePercent = Math.round((weeklyPracticeCount / totalCount) * 100);
      const chatPercent = Math.max(0, 100 - practicePercent);
      return [
        { name: '문장 연습', value: practicePercent, color: '#6366f1' },
        { name: 'AI 대화', value: chatPercent, color: '#22c55e' },
      ];
    }

    // 3) 주간 데이터가 비어있으면 오늘치로 폴백
    const todayPractice = Number(dailyStats?.practiceCount || 0) || 0;
    const todayChat = Number(dailyStats?.chatTurnsCount || 0) || 0;
    const todayTotal = todayPractice + todayChat;
    if (todayTotal > 0) {
      const practicePercent = Math.round((todayPractice / todayTotal) * 100);
      const chatPercent = Math.max(0, 100 - practicePercent);
      return [
        { name: '문장 연습', value: practicePercent, color: '#6366f1' },
        { name: 'AI 대화', value: chatPercent, color: '#22c55e' },
      ];
    }

    return [
      { name: '데이터 없음', value: 1, color: '#e5e7eb' },
    ];
  }, [weeklyList, dailyStats, summary, deltaPractice, deltaChatTurns]);

  // 최근 AI 대화 조회
  useEffect(() => {
    const fetchRecentChats = async () => {
      if (!user?.email) return;

      try {
        setChatsLoading(true);
        setChatsError(null);

        const result = await getConversationList(10); // 최근 10개 조회

        // 새 API 응답 형식 매핑
        const chats = (result?.data || []).map(conv => ({
          conversationId: conv.conversation_id,
          topic: conv.topic,
          difficulty: conv.difficulty,
          turnCount: conv.turn_count,
          startedAt: conv.timestamp,
          preview: conv.preview,
        }));

        setRecentChats(chats);
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
            <h2 className="text-xl font-black tracking-tight">학습 통계</h2>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
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
      <div className="h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto pt-6 pb-14 px-4 md:px-8">
          <div className="space-y-8 max-w-[1600px] w-full mx-auto">
            {/* breadcrumb */}
            <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-[#617589] dark:text-gray-400 font-semibold">Home</span>
            <span className="text-[#617589] dark:text-gray-400">/</span>
            <span className="text-[#111418] dark:text-white font-semibold">학습 통계</span>
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

        {/* 오늘 요약 */}
        <section className="bg-white dark:bg-[#1a242f] rounded-xl p-6 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-lg text-[#111418] dark:text-white">오늘 요약</h3>
            <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded">오늘</span>
          </div>

          {/* 기본 통계 (4열) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-2xl font-black text-[#111418] dark:text-white">
                {formatTime(dailyStats?.totalRecordingTime || 0)}
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">총 학습 시간</p>
            </div>
            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-2xl font-black text-[#111418] dark:text-white">
                {formatTime(dailyStats?.totalSpeakingTime || 0)}
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">총 발화 시간</p>
            </div>
            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-2xl font-black text-[#111418] dark:text-white">
                {dailyStats?.practiceCount ?? 0}회
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">문장 연습</p>
            </div>
            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-2xl font-black text-[#111418] dark:text-white">
                {dailyStats?.chatTurnsCount ?? 0}회
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">AI 대화</p>
            </div>
          </div>

          {/* 품질 지표 (3열) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-3xl font-black text-primary">
                {densityValue.toFixed(1)}%
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">발화율</p>
            </div>

            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-3xl font-black text-yellow-600 dark:text-yellow-400">
                {qualityValue.toFixed(1)}점
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">응답 품질</p>
            </div>

            <div className="text-center p-4 bg-background-light dark:bg-gray-800 rounded-xl border border-[#dbe0e6]/60 dark:border-gray-700">
              <p className="text-3xl font-black text-sky-600 dark:text-sky-400">
                {paceRatioValue.toFixed(2)}
              </p>
              <p className="text-xs font-semibold text-[#617589] dark:text-gray-400 mt-1">속도 비율</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-6">
            <WeeklySummary weeklySummary={weeklySummary} variant="statics" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <LearningTrendChart weeklyData={weeklyTrendData} variant="statics" />
            </div>
            <div>
              <ActivityDistributionChart data={activityDistributionData} variant="statics" />
            </div>
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
      </div>
    </div>
    </StudentLayout>
  );
}
