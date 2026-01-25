import { useState, useEffect } from 'react';
import { getConversationDetail } from '../../../api/conversations';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function Banner({ tone = 'info', title, children }) {
  const styles =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200'
      : tone === 'warning'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-200'
        : 'border-primary/20 bg-primary/10 text-[#111418] dark:text-white';

  return (
    <div className={clsx('rounded-xl border px-4 py-3', styles)}>
      {title ? <p className="text-sm font-bold">{title}</p> : null}
      {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
    </div>
  );
}

export default function ChatDetailDialog({
  open,
  onClose,
  conversationId,
  sessionMetadata
}) {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && conversationId) {
      fetchConversation();
    }
  }, [open, conversationId]);

  const fetchConversation = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getConversationDetail(conversationId);
      setConversation(result.data);
    } catch (err) {
      console.error('Failed to fetch conversation:', err);
      setError('대화 내용을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const messages = conversation?.messages || [];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="대화 기록"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="닫기"
      />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#1a242f] shadow-2xl">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#dbe0e6] dark:border-gray-800 px-6 py-5">
          <div>
            <h3 className="text-lg font-black text-[#111418] dark:text-white">대화 기록</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black bg-primary/10 text-primary border border-primary/20">
                {sessionMetadata?.topic || conversation?.topic || '일반 대화'}
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border border-[#dbe0e6] dark:border-gray-800 text-[#617589] dark:text-gray-400">
                {sessionMetadata?.difficulty || conversation?.difficulty || '중'}
              </span>
              {sessionMetadata?.turnCount != null ? (
                <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-black border border-[#dbe0e6] dark:border-gray-800 text-[#617589] dark:text-gray-400">
                  {sessionMetadata.turnCount} turns
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <p className="mt-1 text-xs font-semibold text-[#617589] dark:text-gray-400">
              {sessionMetadata?.startedAt
                ? formatDistanceToNow(new Date(sessionMetadata.startedAt), { addSuffix: true, locale: ko })
                : ''}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg h-10 w-10 bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 hover:border-primary/30 transition"
              title="닫기"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10">
              <span className="inline-block size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <p className="text-sm font-semibold text-[#111418] dark:text-white">대화 내용을 불러오는 중...</p>
            </div>
          ) : error ? (
            <Banner tone="error" title="오류">{error}</Banner>
          ) : messages.length === 0 ? (
            <p className="text-sm text-[#617589] dark:text-gray-400 text-center py-10">대화 내용이 없습니다.</p>
          ) : (
            <div className="space-y-4">
              {conversation?.situation ? (
                <Banner title="상황">
                  <p className="text-sm opacity-90">
                    <span className="font-black">상황:</span> {conversation.situation}
                  </p>
                  {conversation?.role ? (
                    <p className="mt-1 text-sm opacity-90">
                      <span className="font-black">역할:</span> {conversation.role}
                    </p>
                  ) : null}
                </Banner>
              ) : null}

              <div className="space-y-3">
                {messages.map((msg, index) => {
                  const isUser = msg?.role === 'user';
                  return (
                    <div
                      key={index}
                      className={clsx('flex items-start gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
                    >
                      <div
                        className={clsx(
                          'flex items-center justify-center size-10 rounded-full border',
                          isUser
                            ? 'bg-primary text-white border-primary/20'
                            : 'bg-primary/10 text-primary border-primary/20'
                        )}
                      >
                        <span className="material-symbols-outlined">{isUser ? 'person' : 'smart_toy'}</span>
                      </div>

                      <div
                        className={clsx(
                          'max-w-[75%] rounded-2xl px-4 py-3 border',
                          isUser
                            ? 'bg-primary text-white border-primary/20'
                            : 'bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border-[#dbe0e6] dark:border-gray-700'
                        )}
                      >
                        <p className="text-sm font-medium whitespace-pre-wrap">{msg?.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#dbe0e6] dark:border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-black bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 hover:border-primary/30 transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
