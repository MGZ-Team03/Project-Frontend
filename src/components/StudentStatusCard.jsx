import React from 'react';
import { getStudentStatus, getTimeAgo, formatTimestamp } from '../utils/timeUtils';

/**
 * 학생 상태 카드 컴포넌트
 * 튜터 대시보드에서 학생의 실시간 상태를 표시
 */
const StudentStatusCard = ({ student }) => {
  const statusInfo = getStudentStatus(student);
  const lastSeen = getTimeAgo(student.updated_at);
  const formattedTime = formatTimestamp(student.updated_at);

  return (
    <div className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 상태 표시 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{statusInfo.emoji}</span>
          <span className={`font-semibold text-${statusInfo.color}-600`}>
            {statusInfo.statusText}
          </span>
        </div>
        <span className="text-xs text-gray-500">{lastSeen}</span>
      </div>

      {/* 학생 정보 */}
      <div className="mb-3">
        <h3 className="font-bold text-lg">{student.studentName}</h3>
        <p className="text-sm text-gray-600">{student.studentEmail}</p>
      </div>

      {/* 현재 활동 (온라인일 경우만) */}
      {statusInfo.emoji === "🟢" && student.room !== "no room" && (
        <div className="mb-2 p-2 bg-green-50 rounded text-sm">
          {student.room === "ai" ? "💬 AI대화 중" : "📝 문장연습 중"}
        </div>
      )}

      {/* 마지막 활동 시간 */}
      <div className="text-xs text-gray-500 mt-2">
        <div className="flex justify-between">
          <span>마지막 활동:</span>
          <span className="font-mono">{formattedTime}</span>
        </div>
        {student.assignedAt && (
          <div className="flex justify-between mt-1">
            <span>배정일:</span>
            <span>{new Date(student.assignedAt).toLocaleDateString('ko-KR')}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentStatusCard;
