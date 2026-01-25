import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import ChatDetailDialog from './ChatDetailDialog';

function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function RecentChats({ chats }) {
  const [selectedChat, setSelectedChat] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewChat = (chat) => {
    setSelectedChat(chat);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedChat(null);
  };
  if (!chats || chats.length === 0) {
    return (
      <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
        <h3 className="font-black text-xl text-[#111418] dark:text-white">최근 AI 대화</h3>
        <p className="mt-2 text-sm text-[#617589] dark:text-gray-400">아직 AI 대화 기록이 없습니다.</p>
      </section>
    );
  }

  return (
    <>
      <section className="bg-white dark:bg-[#1a242f] rounded-xl p-8 border border-[#dbe0e6] dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-black text-xl text-[#111418] dark:text-white">최근 AI 대화</h3>
          <span className="text-xs font-black text-[#617589] dark:text-gray-400">{chats.length}개</span>
        </div>

        <div className="mt-6 space-y-3">
          {chats.map((chat, index) => {
            const when =
              chat?.startedAt
                ? formatDistanceToNow(new Date(chat.startedAt), { addSuffix: true, locale: ko })
                : '';

            return (
              <div
                key={chat.sessionId || index}
                className="rounded-xl border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#101922] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-primary/10 text-primary border border-primary/20">
                      {chat.topic || '일반 대화'}
                    </span>
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border border-[#dbe0e6] dark:border-gray-800 text-[#617589] dark:text-gray-400">
                      {chat.difficulty || '중'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#617589] dark:text-gray-400">{when}</span>
                    {chat.conversationId ? (
                      <button
                        type="button"
                        onClick={() => handleViewChat(chat)}
                        className="inline-flex items-center justify-center rounded-lg h-9 w-9 bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 hover:border-primary/30 transition"
                        title="대화 내용 보기"
                      >
                        <span className="material-symbols-outlined text-[20px]">chat_bubble</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[#617589] dark:text-gray-400">
                  <span>
                    턴 수: <span className="font-black text-[#111418] dark:text-white">{chat.turnCount || 0}회</span>
                  </span>
                  <span>
                    시간:{' '}
                    <span className="font-black text-[#111418] dark:text-white">
                      {Math.floor((chat.totalDuration || 0) / 60000)}분
                    </span>
                  </span>
                  {chat.avgResponseQuality > 0 ? (
                    <span>
                      품질:{' '}
                      <span className="font-black text-[#111418] dark:text-white">
                        {chat.avgResponseQuality.toFixed(1)}점
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

    {selectedChat && (
      <ChatDetailDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        conversationId={selectedChat.conversationId}
        sessionMetadata={{
          topic: selectedChat.topic,
          difficulty: selectedChat.difficulty,
          startedAt: selectedChat.startedAt,
          turnCount: selectedChat.turnCount
        }}
      />
    )}
    </>
  );
}
