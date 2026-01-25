import StudentLayout from '../../components/common/StudentLayout';
import { CLOUDFRONT_URL } from '../../utils/constants';

export default function LandingPage() {
  return (
    <StudentLayout
      mode="session"
      sessionHeader={
        <header className="flex items-center justify-between bg-white dark:bg-background-dark border-b border-[#dbe0e6] dark:border-gray-800 px-4 md:px-8 py-4 sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#111418] dark:text-white">
              SpeakTracker 소개
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#617589] dark:text-gray-400">
              입 움직임 + 음성 신호로 ‘진짜 발화 시간’을 추적합니다.
            </p>
          </div>
        </header>
      }
    >
      <div className="w-full">
        <div className="rounded-2xl border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#1a242f] overflow-hidden shadow-sm">
        <iframe
          src={CLOUDFRONT_URL}
          className="block w-full h-[80vh] lg:h-[85vh]"
          title="SpeakTracker 소개"
          loading="lazy"
        />
        </div>
      </div>
    </StudentLayout>
  );
}
