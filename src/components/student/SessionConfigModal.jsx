import { useEffect, useMemo, useState } from 'react';
import { getAllDifficulties } from '../../data/conversation/difficultyLevels';
import { getScenarioById, scenarios } from '../../data/conversation/scenarios';

function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function SessionConfigModal({
  open,
  mode, // 'practice' | 'chat'
  defaultDifficulty = '중',
  defaultScenarioId = 'small_talk',
  onClose,
  onConfirm,
}) {
  const isPractice = mode === 'practice';

  const difficultyOptions = useMemo(() => getAllDifficulties(), []);
  const scenarioOptions = useMemo(() => scenarios, []);

  const safeDefaultScenarioId = useMemo(() => {
    return getScenarioById(defaultScenarioId) ? defaultScenarioId : 'small_talk';
  }, [defaultScenarioId]);

  const [difficulty, setDifficulty] = useState(defaultDifficulty);
  const [scenarioId, setScenarioId] = useState(safeDefaultScenarioId);

  useEffect(() => {
    if (!open) return;
    setDifficulty(defaultDifficulty || '중');
    setScenarioId(safeDefaultScenarioId || 'small_talk');
  }, [open, defaultDifficulty, safeDefaultScenarioId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isPractice ? 'Sentence Practice Setup' : 'AI Conversation Setup'}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#dbe0e6] dark:border-gray-800 bg-white dark:bg-[#1a242f] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#dbe0e6] dark:border-gray-800 px-6 py-5">
          <div>
            <h3 className="text-lg font-black text-[#111418] dark:text-white">
              {isPractice ? 'Sentence Practice Setup' : 'AI Conversation Setup'}
            </h3>
            <p className="mt-1 text-sm text-[#617589] dark:text-gray-400">
              Choose difficulty and topic to start.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg h-10 w-10 bg-background-light dark:bg-gray-800 text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 hover:border-primary/30 transition"
            title="Close"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#617589] dark:text-gray-500">
              Difficulty
            </p>
            <div className="grid grid-cols-3 gap-2">
              {difficultyOptions.map((d) => {
                const active = difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDifficulty(d.id)}
                    className={clsx(
                      'h-11 rounded-full text-sm font-black border transition',
                      active
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white dark:bg-transparent text-[#111418] dark:text-white border-[#dbe0e6] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5'
                    )}
                    title={d.description}
                  >
                    {d.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#617589] dark:text-gray-500">
              Topic
            </p>
            <select
              className="form-select w-full rounded-full text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 bg-white dark:bg-[#0d141c] focus:border-primary focus:ring-4 focus:ring-primary/10 h-11 px-5 text-sm font-semibold transition-all"
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
            >
              {scenarioOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            <p className="text-xs text-[#617589] dark:text-gray-400 leading-relaxed">
              {getScenarioById(scenarioId)?.description || ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[#dbe0e6] dark:border-gray-800 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg h-10 px-4 bg-white dark:bg-transparent text-[#111418] dark:text-white border border-[#dbe0e6] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 transition text-sm font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof onConfirm !== 'function') return;
              onConfirm(
                isPractice
                  ? { difficulty, topicId: scenarioId }
                  : { difficulty, scenario: scenarioId }
              );
            }}
            className="inline-flex items-center justify-center rounded-lg h-10 px-5 bg-primary text-white hover:bg-primary/90 transition text-sm font-black shadow-lg shadow-primary/20"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
