/**
 * 타임스탬프 기반 온라인/오프라인 상태 판단 유틸리티
 */

/**
 * 마지막 업데이트 시간으로 온라인 상태 판단
 * @param {number} updatedAt - 밀리초 타임스탬프
 * @param {number} thresholdMinutes - 온라인 판단 기준 (분) - 기본값: 5분
 * @returns {boolean} true: 온라인, false: 오프라인
 */
export const isOnline = (updatedAt, thresholdMinutes = 5) => {
  if (!updatedAt) return false;
  
  const now = Date.now();
  const diff = now - updatedAt;
  const diffMinutes = diff / (1000 * 60);
  
  return diffMinutes <= thresholdMinutes;
};

/**
 * 마지막 활동 시간을 "N분 전" 형식으로 변환
 * @param {number} updatedAt - 밀리초 타임스탬프
 * @returns {string} "방금 전", "3분 전", "2시간 전" 등
 */
export const getTimeAgo = (updatedAt) => {
  if (!updatedAt) return "알 수 없음";
  
  const now = Date.now();
  const diff = now - updatedAt;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  return `${days}일 전`;
};

/**
 * 학생의 실시간 상태 판단
 * @param {Object} student - 학생 데이터 { status, room, updated_at }
 * @returns {Object} { statusText, emoji, color }
 */
export const getStudentStatus = (student) => {
  if (!student) {
    return {
      status: "offline",
      emoji: "⚪",
      activity: "오프라인",
      color: "gray"
    };
  }

  // updated_at이 없으면 비로그인 상태
  if (!student.updated_at) {
    return {
      status: "offline",
      emoji: "⚪",
      activity: "비로그인",
      color: "gray"
    };
  }
  
  // status가 inactive이면 항상 오프라인 (시간 관계없이)
  if (student.status === "inactive") {
    return {
      status: "offline",
      emoji: "🔴",
      activity: "로그아웃",
      color: "red"
    };
  }
  
  const minutesAgo = (Date.now() - student.updated_at) / (1000 * 60);
  
  // 20분 이내 업데이트 → 실시간 온라인
  if (minutesAgo <= 20) {
    if (student.room === "ai") {
      return {
        status: "ai",
        emoji: "🔵",
        activity: "AI 대화",
        color: "blue"
      };
    }
    if (student.room === "sentence") {
      return {
        status: "sentence",
        emoji: "🟣",
        activity: "문장 연습",
        color: "purple"
      };
    }
    return {
      status: "online",
      emoji: "🟢",
      activity: "온라인",
      color: "green"
    };
  }
  
  // 20분~60분 → 자리비움 (마지막 활동 위치 표시)
  if (minutesAgo <= 60) {
    let activity = "자리비움";
    if (student.room === "ai") {
      activity = "자리비움 (AI 대화)";
    } else if (student.room === "sentence") {
      activity = "자리비움 (문장 연습)";
    }
    
    return {
      status: "away",
      emoji: "🟡",
      activity: activity,
      color: "yellow"
    };
  }
  
  // 60분 이상 → 오프라인
  return {
    status: "offline",
    emoji: "⚪",
    activity: "오프라인",
    color: "gray"
  };
};

/**
 * 타임스탬프를 로컬 시간 문자열로 변환
 * @param {number} timestamp - 밀리초 타임스탬프
 * @returns {string} "2026-01-27 14:25:45"
 */
export const formatTimestamp = (timestamp) => {
  if (!timestamp) return "-";
  
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};
