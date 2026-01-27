import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { login, clearError } from '../store/slices/authSlice';
import { USER_ROLES } from '../utils/constants';
import AuthLayout from '../components/auth/AuthLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, error, user } = useSelector((state) => state.auth);


  // 로그인 성공 시 역할에 따라 리다이렉트
  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === USER_ROLES.TUTOR) {
        navigate('/tutor');
      } else {
        navigate('/home');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearError());
    dispatch(login({ email, password }));
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="로그인 정보를 입력해주세요.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-2">
          <label className="text-[#111418] dark:text-white text-sm font-semibold leading-normal ml-1">
            Email Address
          </label>
          <input
            className="form-input w-full rounded-full text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-background-dark/50 focus:border-primary focus:ring-4 focus:ring-primary/10 h-14 px-6 text-base font-normal placeholder:text-[#617589] transition-all"
            placeholder="name@company.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[#111418] dark:text-white text-sm font-semibold leading-normal">
              Password
            </label>
            <button
              type="button"
              className="text-primary text-sm font-semibold hover:underline"
              onClick={() => alert('비밀번호 찾기는 아직 준비중입니다.')}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              className="form-input w-full rounded-full text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-background-dark/50 focus:border-primary focus:ring-4 focus:ring-primary/10 h-14 px-6 pr-14 text-base font-normal placeholder:text-[#617589] transition-all"
              placeholder="••••••••"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="absolute right-5 top-1/2 -translate-y-1/2 text-[#617589] hover:text-[#111418] dark:hover:text-white transition"
              onClick={() => setShowPassword((v) => !v)}
              aria-label="비밀번호 표시 전환"
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <button
          className="w-full flex items-center justify-center rounded-full h-14 bg-primary text-white text-base font-bold tracking-wide hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 mt-4 disabled:opacity-60 disabled:cursor-not-allowed"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? '로그인 중...' : 'Login to Account'}
        </button>
      </form>

      <div className="mt-8 flex items-center justify-center gap-2 text-[#617589] dark:text-gray-400 text-sm font-medium">
        <span>계정이 없으신가요?</span>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full px-3 py-1.5 text-primary font-bold hover:bg-primary/10 hover:underline transition"
          onClick={() => navigate('/signup')}
        >
          회원가입
        </button>
      </div>
    </AuthLayout>
  );
}
