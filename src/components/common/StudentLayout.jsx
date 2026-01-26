import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { useWhisperGlobalPreload } from '../../hooks/useWhisperSTT';
import SessionConfigModal from '../student/SessionConfigModal';
import {
  selectWhisperPreloadStatus,
  selectWhisperProgress,
} from '../../store/slices/whisperPreloadSlice';

export default function StudentLayout({ 
  children, 
  todayTime = 0, 
  onTutorSearchClick, 
  onNotificationClick, 
  unreadNotificationCount = 0,
  mode = 'default',
  sessionHeader = null,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const [isDark, setIsDark] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const { preloadGlobal } = useWhisperGlobalPreload();
  const whisperStatus = useSelector(selectWhisperPreloadStatus);
  const whisperProgress = useSelector(selectWhisperProgress);
  const dailyRecordingMs = useSelector((state) => state.speakingStats?.dailyStats?.totalRecordingTime || 0);
  const sessionRecordingMs = useSelector((state) => state.speakingStats?.currentSession?.totalRecordingTime || 0);
  const todayTimeSec = Math.floor((dailyRecordingMs + sessionRecordingMs) / 1000);

  // 마운트 시 1회 preload (이미 ready면 스킵)
  useEffect(() => {
    preloadGlobal();
  }, [preloadGlobal]);

  // 다크모드 초기화/동기화
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
    const shouldDark = saved ? saved === 'dark' : !!prefersDark;

    setIsDark(shouldDark);
    document.documentElement.classList.toggle('dark', shouldDark);
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const navItems = useMemo(
    () => [
      { key: 'home', label: 'Home', path: '/home', icon: 'home', enabled: true },
      { key: 'practice', label: 'Sentence Practice', path: '/practice', icon: 'format_quote', enabled: true },
      { key: 'chat', label: 'AI Conversation', path: '/chat', icon: 'forum', enabled: true },
      { key: 'stats', label: 'Statistics', path: '/stats', icon: 'leaderboard', enabled: true },
      { key: 'introduce', label: 'Introduce', path: '/introduce', icon: 'info', enabled: true },
      { key: 'profile', label: 'Profile', path: '/profile', icon: 'person', enabled: true },
    ],
    []
  );

  const formatTodayTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}분 ${s}초`;
  };

  const roleLabel = user?.role === 'student' ? '학생' : user?.role === 'tutor' ? '튜터' : '게스트';

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const [sessionConfigOpen, setSessionConfigOpen] = useState(false);
  const [sessionConfigMode, setSessionConfigMode] = useState(null); // 'practice' | 'chat'
  const [sessionConfigDefaults, setSessionConfigDefaults] = useState({
    difficulty: '중',
    scenarioId: 'small_talk',
  });

  const isNavPathActive = (path) => {
    if (!path || path === '#') return false;
    if (location?.pathname === path) return true;
    return location?.pathname?.startsWith?.(`${path}/`);
  };

  const readJson = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  };

  const openSessionConfig = (mode) => {
    const defaults = { difficulty: '중', scenarioId: 'small_talk' };

    if (mode === 'practice') {
      const saved = readJson('student.practiceConfig');
      const difficulty = typeof saved?.difficulty === 'string' ? saved.difficulty : defaults.difficulty;
      const scenarioId = typeof saved?.topicId === 'string' ? saved.topicId : defaults.scenarioId;
      setSessionConfigDefaults({ difficulty, scenarioId });
    } else if (mode === 'chat') {
      const saved = readJson('student.chatConfig');
      const difficulty = typeof saved?.difficulty === 'string' ? saved.difficulty : defaults.difficulty;
      const scenarioId = typeof saved?.scenario === 'string' ? saved.scenario : defaults.scenarioId;
      setSessionConfigDefaults({ difficulty, scenarioId });
    } else {
      setSessionConfigDefaults(defaults);
    }

    setSessionConfigMode(mode);
    setSessionConfigOpen(true);
  };

  const persistConfig = (mode, payload) => {
    try {
      if (mode === 'practice') {
        localStorage.setItem(
          'student.practiceConfig',
          JSON.stringify({ difficulty: payload.difficulty, topicId: payload.topicId })
        );
      } else if (mode === 'chat') {
        localStorage.setItem(
          'student.chatConfig',
          JSON.stringify({ difficulty: payload.difficulty, scenario: payload.scenario })
        );
      }
    } catch (_) {}
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-[#111418] dark:text-white min-h-screen select-none">
      <div className="flex h-screen w-full overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`border-r border-[#e5e7eb] dark:border-[#2d3748] bg-white dark:bg-background-dark flex flex-col justify-between py-6 flex-shrink-0 transition-[width] duration-200 ease-out ${
            isSidebarExpanded ? 'w-64' : 'w-20'
          }`}
        >
          <div className="flex flex-col gap-10 items-center w-full">
            <button
              type="button"
              onClick={() => setIsSidebarExpanded((v) => !v)}
              className={`rounded-lg p-2 text-[#111418] dark:text-white hover:bg-[#f0f2f4] dark:hover:bg-primary/10 transition flex items-center justify-center ${
                isSidebarExpanded ? 'w-[calc(100%-24px)] mx-3' : ''
              }`}
              title="메뉴"
              aria-label="사이드바 토글"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
              {isSidebarExpanded && <span className="ml-3 text-sm font-bold tracking-tight">메뉴</span>}
            </button>

            <nav className="flex flex-col gap-2 w-full px-3">
              {navItems.map((item) => {
                const base = `relative flex items-center rounded-xl transition-all group ${
                  isSidebarExpanded ? 'w-full h-12 px-3 justify-start' : 'w-12 h-12 mx-auto justify-center'
                }`;
                const enabledHover = 'hover:bg-[#f0f2f4] dark:hover:bg-primary/10';
                const disabled = 'opacity-40 cursor-not-allowed';
                const iconBase = 'material-symbols-outlined text-[24px] transition-colors';
                const active = isNavPathActive(item.path);
                const itemIsSession = item.key === 'practice' || item.key === 'chat';

                if (!item.enabled) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${base} ${enabledHover} ${disabled}`}
                      title={item.label}
                      onClick={() => alert('준비중입니다.')}
                    >
                      <span className={`${iconBase} text-[#617589] dark:text-[#a0aec0] group-hover:text-primary`}>
                        {item.icon}
                      </span>
                      {isSidebarExpanded ? (
                        <span className="ml-3 text-sm font-semibold text-[#617589] dark:text-[#a0aec0]">
                          {item.label}
                        </span>
                      ) : (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.label} (Coming soon)
                        </span>
                      )}
                    </button>
                  );
                }

                if (itemIsSession) {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className={`${base} ${active ? 'bg-primary text-white' : enabledHover}`}
                      title={item.label}
                      onClick={() => openSessionConfig(item.key === 'practice' ? 'practice' : 'chat')}
                    >
                      <span
                        className={`${iconBase} ${
                          active
                            ? 'text-white'
                            : 'text-[#617589] dark:text-[#a0aec0] group-hover:text-primary'
                        }`}
                      >
                        {item.icon}
                      </span>
                      {isSidebarExpanded ? (
                        <span className={`ml-3 text-sm font-semibold ${active ? 'text-white' : 'text-[#111418] dark:text-white'}`}>
                          {item.label}
                        </span>
                      ) : (
                        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                          {item.label}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) => `${base} ${isActive ? 'bg-primary text-white' : enabledHover}`}
                    title={item.label}
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`${iconBase} ${
                            isActive
                              ? 'text-white'
                              : 'text-[#617589] dark:text-[#a0aec0] group-hover:text-primary'
                          }`}
                        >
                          {item.icon}
                        </span>
                        {isSidebarExpanded ? (
                          <span
                            className={`ml-3 text-sm font-semibold ${
                              isActive ? 'text-white' : 'text-[#111418] dark:text-white'
                            }`}
                          >
                            {item.label}
                          </span>
                        ) : (
                          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                            {item.label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-col gap-6 items-center w-full px-3">
            <div className="group relative">
              {whisperStatus === 'ready' ? (
                <span className="material-symbols-outlined text-green-500 text-[24px] cursor-help">
                  check_circle
                </span>
              ) : whisperStatus === 'loading' ? (
                <span className="material-symbols-outlined text-primary text-[24px] animate-spin cursor-help">
                  sync
                </span>
              ) : (
                <span className="material-symbols-outlined text-[#617589] dark:text-[#a0aec0] text-[24px] cursor-help">
                  info
                </span>
              )}
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                STT: {whisperStatus}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="w-12 h-12 flex items-center justify-center rounded-xl bg-primary text-white shadow-md hover:bg-primary/90 transition-all group relative"
              title="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              <span className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
                Logout
              </span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-background-light dark:bg-[#0d141c]">
          <div className={mode === 'session' ? 'w-full' : 'max-w-[1400px] w-full mx-auto'}>
            {mode === 'session' ? (
              <div className="sticky top-0 z-40 w-full">{sessionHeader}</div>
            ) : (
              <div className="flex flex-wrap justify-between items-center gap-3 p-6 md:p-8">
                <div className="flex min-w-72 flex-col gap-1">
                  <p className="text-[#111418] dark:text-white text-3xl md:text-4xl font-black tracking-tight">
                    안녕하세요, {user?.name || user?.email || '학생'}님
                  </p>
                  <p className="text-[#617589] dark:text-[#a0aec0] text-base font-normal">
                    오늘도 목표 시간 채워볼까요?
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {onTutorSearchClick && (
                    <button
                      type="button"
                      onClick={onTutorSearchClick}
                      className="relative flex items-center justify-center rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition"
                    >
                      <span className="material-symbols-outlined text-[18px] mr-2">person_add</span>
                      튜터 찾기
                      {unreadNotificationCount > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-black">
                          {unreadNotificationCount}
                        </span>
                      )}
                    </button>
                  )}

                  <div className="flex items-center justify-center rounded-lg h-10 px-4 bg-white dark:bg-background-dark shadow-sm border border-[#e5e7eb] dark:border-[#2d3748] text-[#111418] dark:text-white text-sm font-bold">
                    <span className="material-symbols-outlined text-[20px] mr-2 text-primary">timer</span>
                    오늘 학습 {formatTodayTime(todayTimeSec || todayTime)}
                  </div>

                  <div className="flex items-center justify-center rounded-lg h-10 px-4 bg-white dark:bg-background-dark shadow-sm border border-[#e5e7eb] dark:border-[#2d3748] text-[#111418] dark:text-white text-sm font-bold">
                    <span className="material-symbols-outlined text-[20px] mr-2 text-yellow-500">stars</span>
                    {roleLabel}
                  </div>

                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="flex items-center justify-center rounded-lg h-10 px-3 bg-white dark:bg-background-dark shadow-sm border border-[#e5e7eb] dark:border-[#2d3748] text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition"
                    aria-label="테마 전환"
                    title="테마 전환"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isDark ? 'light_mode' : 'dark_mode'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Whisper banner */}
            {whisperStatus === 'loading' && (
              <div className={mode === 'session' ? 'px-4 md:px-6 -mt-2 pb-4' : 'px-6 md:px-8 -mt-2 pb-4'}>
                <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block size-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm font-semibold text-[#111418] dark:text-white">
                      음성인식 모델 준비 중...
                    </p>
                    {whisperProgress?.percent != null && (
                      <p className="text-sm font-black text-primary">{whisperProgress.percent}%</p>
                    )}
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-[#dbe0e6] dark:bg-[#2d3748] overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width:
                          whisperProgress?.percent != null ? `${whisperProgress.percent}%` : '35%',
                      }}
                    />
                  </div>
                  {whisperProgress?.file && (
                    <p className="mt-2 text-xs text-[#617589] dark:text-[#a0aec0]">파일: {whisperProgress.file}</p>
                  )}
                </div>
              </div>
            )}

            {/* Content */}
            <div className={mode === 'session' ? 'py-8 px-4' : 'px-6 md:px-8 pb-8'}>{children}</div>
          </div>
        </main>
      </div>

      <SessionConfigModal
        open={sessionConfigOpen}
        mode={sessionConfigMode}
        defaultDifficulty={sessionConfigDefaults.difficulty}
        defaultScenarioId={sessionConfigDefaults.scenarioId}
        onClose={() => {
          setSessionConfigOpen(false);
          setSessionConfigMode(null);
        }}
        onConfirm={(payload) => {
          const modeKey = sessionConfigMode;
          if (!modeKey) return;
          persistConfig(modeKey, payload);
          setSessionConfigOpen(false);
          setSessionConfigMode(null);
          if (modeKey === 'practice') {
            navigate('/practice', {
              state: {
                difficulty: payload.difficulty,
                topicId: payload.topicId,
                startNonce: Date.now(),
              },
            });
          } else if (modeKey === 'chat') {
            navigate('/chat', { state: { difficulty: payload.difficulty, scenario: payload.scenario } });
          }
        }}
      />
    </div>
  );
}
