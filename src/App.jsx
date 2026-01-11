import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { store } from './store';
import { checkAuth } from './store/slices/authSlice';

// Pages
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import PracticePage from './pages/student/PracticePage';
// TODO: 아래 페이지들은 추후 구현
// import ChatPage from './pages/student/ChatPage';
// import StatsPage from './pages/student/StatsPage';
// import DashboardPage from './pages/tutor/DashboardPage';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';

// 임시 플레이스홀더 컴포넌트
const PlaceholderPage = ({ title }) => (
  <div style={{ padding: '20px', textAlign: 'center' }}>
    <h1>{title}</h1>
    <p>이 페이지는 추후 구현 예정입니다.</p>
  </div>
);

function AppContent() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      
      {/* 학생 페이지 */}
      <Route path="/practice" element={
        <ProtectedRoute allowedRoles={['student']}>
          <PracticePage />
        </ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute allowedRoles={['student']}>
          <PlaceholderPage title="💬 AI 대화" />
        </ProtectedRoute>
      } />
      <Route path="/stats" element={
        <ProtectedRoute allowedRoles={['student']}>
          <PlaceholderPage title="📊 학습 통계" />
        </ProtectedRoute>
      } />
      
      {/* 튜터 페이지 */}
      <Route path="/tutor" element={
        <ProtectedRoute allowedRoles={['tutor']}>
          <PlaceholderPage title="👨‍🏫 튜터 대시보드" />
        </ProtectedRoute>
      } />
      
      {/* 기본 리다이렉트 */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
