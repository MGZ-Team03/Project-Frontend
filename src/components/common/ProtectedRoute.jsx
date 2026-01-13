import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // 미인증 시 로그인으로 리다이렉트
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 역할 제한이 있고, 허용되지 않은 역할이면 리다이렉트
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    if (user.role === 'tutor') {
      return <Navigate to="/tutor" replace />;
    }
    return <Navigate to="/practice" replace />;
  }

  return children;
}
