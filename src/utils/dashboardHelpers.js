// 대시보드 헬퍼 유틸리티 함수들

import { getTimeAgo } from './timeUtils';

/**
 * 학생 상태에 따른 스타일 반환
 * @param {string} status - 'online' | 'ai' | 'sentence' | 'away' | 'offline'
 * @returns {Object} - { bg, text, dot } 스타일 클래스
 */
export function getStatusStyles(status) {
  switch (status) {
    case 'online':
      return { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' };
    case 'ai':
      return { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500' };
    case 'sentence':
      return { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500' };
    case 'away':
      return { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' };
    case 'offline':
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-400' };
  }
}

/**
 * 학생 상태 라벨 반환
 * @param {string} status - 'online' | 'ai' | 'sentence' | 'away' | 'offline'
 * @returns {string} - 한글 상태 라벨
 */
export function getStatusLabel(status) {
  switch (status) {
    case 'online': return '온라인';
    case 'ai': return 'AI 대화중';
    case 'sentence': return '문장 연습중';
    case 'away': return '자리비움';
    case 'offline': return '오프라인';
    default: return '오프라인';
  }
}

/**
 * 발음 레벨 정보 계산
 * @param {number} speakingRatio - 발음 비율 (0-100)
 * @returns {Object} - { label, percent, color }
 */
export function getLevelInfo(speakingRatio) {
  if (speakingRatio >= 80) return { label: 'Advanced', percent: 85, color: 'text-[#137fec]' };
  if (speakingRatio >= 60) return { label: 'Intermediate', percent: 60, color: 'text-[#137fec]' };
  if (speakingRatio >= 40) return { label: 'Elementary', percent: 40, color: 'text-[#137fec]' };
  return { label: 'Beginner', percent: 25, color: 'text-[#137fec]' };
}

/**
 * 마지막 활동 시간 텍스트 반환
 * @param {number} updatedAt - 타임스탬프 (ms)
 * @returns {string} - "방금 전", "5분 전" 등
 */
export function getLastActiveText(updatedAt) {
  if (!updatedAt) return '활동 없음';
  return getTimeAgo(updatedAt);
}
