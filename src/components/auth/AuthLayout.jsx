import { useEffect, useState } from 'react';
import { CLOUDFRONT_URL } from '../../utils/constants';

export default function AuthLayout({ title, subtitle, children, showBadges = true }) {
  const [isDark, setIsDark] = useState(false);

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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-0 m-0 overflow-x-hidden font-display">
      <div className="flex h-screen w-full flex-col @container lg:flex-row">
        {/* Left: Hero (Desktop) */}
        <div className="relative hidden h-full w-full lg:flex lg:w-5/12 xl:w-1/3 flex-col justify-end p-16 overflow-hidden">
          <div
            className="absolute inset-0 bg-center bg-cover"
            aria-hidden="true"
            style={{ backgroundImage: `url('${CLOUDFRONT_URL}/login.jpg')` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-background-dark/70" />

          <div className="relative z-10 max-w-lg">
            <div className="mb-6 inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30">
              <span className="material-symbols-outlined text-white text-sm">mic</span>
              <span className="text-white text-xs font-semibold tracking-wide uppercase">
                AI-Powered Learning
              </span>
            </div>
            <h1 className="text-white text-5xl font-black leading-tight tracking-tight mb-6">
              영어, AI로<br />더 자연스럽게.
            </h1>
            <p className="text-white/90 text-lg font-light leading-relaxed">
              실시간 음성/학습 데이터 기반으로 말하기를 훈련하고,<br />더 빠르게 자신감을 쌓아보세요.
            </p>
          </div>
        </div>

        {/* Right: Content */}
        <div className="relative flex flex-1 flex-col justify-center bg-white dark:bg-background-dark px-8 py-12 @[480px]:px-16 @[864px]:px-24">
          <button
            type="button"
            onClick={toggleTheme}
            className="absolute right-6 top-6 inline-flex items-center gap-2 rounded-full border border-[#dbe0e6] dark:border-gray-700 bg-white/80 dark:bg-white/5 backdrop-blur px-4 py-2 text-sm font-semibold text-[#111418] dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition"
            aria-label="테마 전환"
          >
            <span className="material-symbols-outlined text-lg">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
            {isDark ? 'Light' : 'Dark'}
          </button>

          <div className="mx-auto w-full max-w-[440px]">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10">
              <div className="size-10 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
                <svg
                  className="text-white size-6"
                  fill="none"
                  viewBox="0 0 48 48"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8.57829 8.57829C5.52816 11.6284 3.451 15.5145 2.60947 19.7452C1.76794 23.9758 2.19984 28.361 3.85056 32.3462C5.50128 36.3314 8.29667 39.7376 11.8832 42.134C15.4698 44.5305 19.6865 45.8096 24 45.8096C28.3135 45.8096 32.5302 44.5305 36.1168 42.134C39.7033 39.7375 42.4987 36.3314 44.1494 32.3462C45.8002 28.361 46.2321 23.9758 45.3905 19.7452C44.549 15.5145 42.4718 11.6284 39.4217 8.57829L24 24L8.57829 8.57829Z"
                    fill="currentColor"
                  />
                </svg>
              </div>
              <h2 className="text-[#111418] dark:text-white text-2xl font-bold tracking-tight">
                SpeakTracker
              </h2>
            </div>

            {(title || subtitle) && (
              <div className="mb-8">
                {title && (
                  <h3 className="text-[#111418] dark:text-white text-3xl font-bold leading-tight mb-2">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[#617589] dark:text-gray-400 text-base">{subtitle}</p>
                )}
              </div>
            )}

            {children}

            {showBadges && (
              <div className="mt-16 flex justify-center gap-8 opacity-40 text-[#111418] dark:text-white dark:opacity-70">
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-2xl">mic_none</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest">STT Ready</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-2xl">volume_up</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest">TTS Active</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="material-symbols-outlined text-2xl">security</span>
                  <span className="text-[10px] uppercase font-bold tracking-widest">Secure AI</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

