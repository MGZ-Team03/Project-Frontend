import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';

export default function TutorLayout({ 
  children, 
  studentCount = 0,
  onNotificationClick,
  unreadNotificationCount = 0,
  onExportData,
  title = 'Dashboard',
  subtitle = 'SpeakTracker Tutor Portal',
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector(state => state.auth.user);
  const [darkMode, setDarkMode] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const navItems = [
    { icon: 'dashboard', label: 'Dashboard', path: '/tutor/dashboard' },
    { icon: 'group', label: 'Student Management', path: '/tutor/students' },
  ];

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className={`${darkMode ? 'dark' : ''}`}>
      <div className="bg-[#f6f7f8] dark:bg-[#101922] text-[#111418] dark:text-white min-h-screen flex select-none">
        {/* 사이드바 (확장/축소 가능) */}
        <aside className={`border-r border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922] flex flex-col sticky top-0 h-screen shrink-0 z-20 transition-[width] duration-200 ease-out ${
          isSidebarExpanded ? 'w-64' : 'w-[72px]'
        }`}>
          <div className="py-6 flex flex-col items-center">
            {/* 햄버거 메뉴 버튼 */}
            <button
              type="button"
              onClick={() => setIsSidebarExpanded(prev => !prev)}
              className={`rounded-xl p-2 text-[#617589] hover:bg-[#137fec]/10 hover:text-[#137fec] transition flex items-center justify-center mb-6 ${
                isSidebarExpanded ? 'w-[calc(100%-24px)] mx-3' : ''
              }`}
              title="메뉴"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
              {isSidebarExpanded && <span className="ml-3 text-sm font-bold tracking-tight text-[#111418] dark:text-white">메뉴</span>}
            </button>
            
            {/* 네비게이션 */}
            <nav className={`flex flex-col gap-2 w-full px-3 ${isSidebarExpanded ? 'mt-2' : 'mt-0'}`}>
              {navItems.map((item) => {
                const isCurrentActive = isActive(item.path);
                const isDashboardOrProfile = location.pathname === '/tutor/dashboard' || location.pathname === '/tutor/profile';
                const isStudentManagement = item.path === '/tutor/students';
                const shouldDisable = isCurrentActive || (isDashboardOrProfile && isStudentManagement);
                
                return (
                  <button
                    key={item.path}
                    onClick={() => !shouldDisable && navigate(item.path)}
                    disabled={shouldDisable}
                    className={`flex items-center rounded-xl transition-colors group relative ${
                      isSidebarExpanded ? 'w-full h-12 px-3 justify-start' : 'size-11 justify-center mx-auto'
                    } ${
                      isCurrentActive
                        ? 'bg-[#137fec] text-white cursor-default'
                        : shouldDisable
                          ? 'text-[#617589]/40 cursor-not-allowed'
                          : 'text-[#617589] hover:bg-[#137fec]/10 hover:text-[#137fec] cursor-pointer'
                    }`}
                    title={item.label}
                  >
                    <span 
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: isCurrentActive ? "'FILL' 1" : "'FILL' 0" }}
                    >
                      {item.icon}
                    </span>
                    {isSidebarExpanded ? (
                      <span className={`ml-3 text-sm font-semibold ${isCurrentActive ? 'text-white' : shouldDisable ? 'text-[#617589]/40' : 'text-[#111418] dark:text-white'}`}>
                        {item.label}
                      </span>
                    ) : (
                      <span className="absolute left-14 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* 하단 아이콘 */}
          <div className="mt-auto p-3 flex flex-col items-center gap-4 border-t border-[#dbe0e6] dark:border-gray-800 py-6">
            {/* 프로필 */}
            <div 
              className={`cursor-pointer flex items-center ${
                isSidebarExpanded ? 'w-full px-3 py-2 hover:bg-[#137fec]/10 rounded-xl' : ''
              }`}
              onClick={() => navigate('/tutor/profile')}
            >
              <div className="size-10 rounded-full bg-cover bg-center border-2 border-white dark:border-gray-800 shadow-sm bg-[#137fec] flex items-center justify-center text-white font-bold shrink-0">
                {user?.name?.charAt(0) || 'T'}
              </div>
              {isSidebarExpanded && (
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-semibold truncate">{user?.name || 'Tutor'}</p>
                  <p className="text-[10px] text-[#617589] truncate">{user?.email || ''}</p>
                </div>
              )}
            </div>

            {/* 로그아웃 버튼 - StudentLayout 스타일 */}
            <button 
              onClick={handleLogout}
              className={`flex items-center rounded-xl transition-all group relative ${
                isSidebarExpanded ? 'w-full h-11 px-3 justify-start bg-[#137fec] text-white hover:bg-[#137fec]/90' : 'size-11 justify-center bg-[#137fec] text-white shadow-md hover:bg-[#137fec]/90'
              }`}
              title="Logout"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              {isSidebarExpanded ? (
                <span className="ml-3 text-sm font-semibold">
                  로그아웃
                </span>
              ) : (
                <span className="absolute left-14 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  로그아웃
                </span>
              )}
            </button>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
          {/* 헤더 */}
          <header className="h-16 border-b border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922] px-8 flex items-center justify-between sticky top-0 z-10">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
              <p className="text-[10px] text-[#617589] font-medium uppercase tracking-wider">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* 다크모드 토글 - 헤더로 이동 */}
              <button 
                onClick={() => setDarkMode(!darkMode)}
                className="flex items-center justify-center rounded-lg h-10 px-3 bg-white dark:bg-[#101922] shadow-sm border border-[#dbe0e6] dark:border-gray-700 text-[#617589] hover:text-[#137fec] hover:bg-gray-50 dark:hover:bg-white/5 transition"
                title={darkMode ? 'Light Mode' : 'Dark Mode'}
              >
                <span className="material-symbols-outlined text-[20px]">{darkMode ? 'light_mode' : 'dark_mode'}</span>
              </button>

              {/* 알림 버튼 */}
              <button 
                onClick={onNotificationClick}
                className="relative flex items-center justify-center rounded-lg h-10 px-3 bg-white dark:bg-[#101922] shadow-sm border border-[#dbe0e6] dark:border-gray-700 text-[#617589] hover:text-[#137fec] hover:bg-gray-50 dark:hover:bg-white/5 transition"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 size-5 bg-red-500 border-2 border-white dark:border-[#101922] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            </div>
          </header>

          {/* 페이지 콘텐츠 */}
          <div className="p-8 space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
