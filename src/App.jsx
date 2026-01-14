import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { store } from './store';
import { checkAuth } from './store/slices/authSlice';

// Pages - Student
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import HomePage from './pages/student/HomePage';
import PracticePage from './pages/student/PracticePage';
import ChatPage from './pages/student/ChatPage';
import StatsPage from './pages/student/StatsPage';

// Pages - Tutor
import DashboardPage from './pages/tutor/DashboardPage';
import StudentDetailPage from './pages/tutor/StudentDetailPage';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';

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
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </Provider>
  );
}

export default App;
