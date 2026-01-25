import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { store } from './store';
import { checkAuth } from './store/slices/authSlice';
import { loadStatsFromStorage } from './store/slices/speakingStatsSlice';

// Pages - Public
import LandingPage from './pages/public/LandingPage';

// Pages - Student
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/student/HomePage';
import PracticePage from './pages/student/PracticePage';
import ChatPage from './pages/student/ChatPage';
import StatsPage from './pages/student/StatsPage';
import ProfilePage from './pages/student/ProfilePage';

// Pages - Tutor
import DashboardPage from './pages/tutor/DashboardPage';
import StudentDetailPage from './pages/tutor/StudentDetailPage';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';

function AppContent() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [authChecked, setAuthChecked] = useState(false);

  // Step 1: Check auth on mount
  useEffect(() => {
    dispatch(checkAuth()).finally(() => {
      setAuthChecked(true);
    });
  }, [dispatch]);

  // Step 2: Load user-specific stats after auth confirmed
  useEffect(() => {
    // speakingStats는 학생 기능(연습/AI대화/통계)에서만 사용
    if (authChecked && user?.role === 'student' && user?.email) {
      dispatch(loadStatsFromStorage({ userEmail: user.email }));
    }
  }, [authChecked, user?.role, user?.email, dispatch]);

  return (
    <Routes>
      {/* Public Pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* 학생 페이지 */}
      <Route path="/home" element={
        <ProtectedRoute allowedRoles={['student']}>
          <HomePage />
        </ProtectedRoute>
      } />
      <Route path="/practice" element={
        <ProtectedRoute allowedRoles={['student']}>
          <PracticePage />
        </ProtectedRoute>
      } />
      <Route path="/chat" element={
        <ProtectedRoute allowedRoles={['student']}>
          <ChatPage />
        </ProtectedRoute>
      } />
      <Route path="/stats" element={
        <ProtectedRoute allowedRoles={['student']}>
          <StatsPage />
        </ProtectedRoute>
      } />
      <Route path="/introduce" element={
        <ProtectedRoute allowedRoles={['student']}>
          <LandingPage />
        </ProtectedRoute>
      } />
      <Route path="/profile" element={
        <ProtectedRoute allowedRoles={['student', 'tutor']}>
          <ProfilePage />
        </ProtectedRoute>
      } />

      {/* 튜터 페이지 */}
      <Route path="/tutor" element={<Navigate to="/tutor/dashboard" replace />} />
      <Route path="/tutor/dashboard" element={
        <ProtectedRoute allowedRoles={['tutor']}>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/tutor/students" element={
        <ProtectedRoute allowedRoles={['tutor']}>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/tutor/students/:email" element={
        <ProtectedRoute allowedRoles={['tutor']}>
          <StudentDetailPage />
        </ProtectedRoute>
      } />
      <Route path="/tutor/stats" element={
        <ProtectedRoute allowedRoles={['tutor']}>
          <DashboardPage />
        </ProtectedRoute>
      } />

      {/* 기본 리다이렉트 */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Provider store={store}>
      <BrowserRouter future={{ 
        v7_relativeSplatPath: true,
        v7_startTransition: true 
      }}>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
