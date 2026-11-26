import { useCallback, useEffect, useState } from 'react';
import { AnalyticsScreen } from './components/AnalyticsScreen';
import { Dashboard } from './components/Dashboard';
import { ExamInterface } from './components/ExamInterface';
import { ImportModal } from './components/ImportModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PreTestModal } from './components/PreTestModal';
import {
  deleteQuestionSet,
  deleteSessionAttempt,
  exportFullBackup,
  getAllQuestionSets,
  getAllSessions,
  initializeDatabaseWithDemo,
  loadBuiltInDemoSetToDb,
  restoreFullBackup,
  saveQuestionSet,
  saveSessionAttempt,
} from './db/cbtDb';
import type { ExamConfig, QuestionSet, SessionAttempt } from './types/cbt';
import { validateBackupPayload } from './utils/jsonSanitizer';

type AppView =
  | { kind: 'dashboard' }
  | { kind: 'exam'; set: QuestionSet; config: ExamConfig }
  | { kind: 'analytics'; session: SessionAttempt };

export default function App() {
  const [view, setView] = useState<AppView>({ kind: 'dashboard' });
  const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
  const [sessions, setSessions] = useState<SessionAttempt[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [configuringSet, setConfiguringSet] = useState<QuestionSet | null>(null);

  const refreshData = useCallback(async () => {
    const [sets, sess] = await Promise.all([getAllQuestionSets(), getAllSessions()]);
    setQuestionSets(sets);
    setSessions(sess);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initializeDatabaseWithDemo();
        const [sets, sess] = await Promise.all([getAllQuestionSets(), getAllSessions()]);
        if (mounted) {
          setQuestionSets(sets);
          setSessions(sess);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleImportSet = async (newSet: QuestionSet) => {
    await saveQuestionSet(newSet);
    await refreshData();
  };

  const handleDeleteSet = async (id: string) => {
    await deleteQuestionSet(id);
    await refreshData();
  };

  const handleLoadBuiltInDemo = async () => {
    await loadBuiltInDemoSetToDb();
    await refreshData();
  };

  const handleStartExam = (set: QuestionSet, config: ExamConfig) => {
    setConfiguringSet(null);
    setView({ kind: 'exam', set, config });
  };

  const handleCompleteSession = async (attempt: SessionAttempt) => {
    await saveSessionAttempt(attempt);
    await refreshData();
    setView({ kind: 'analytics', session: attempt });
  };

  const handleDeleteSession = async (id: string) => {
    await deleteSessionAttempt(id);
    await refreshData();
  };

  const handleExportAllBackup = async () => {
    const payload = await exportFullBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `jee_cbt_backup_${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreAllBackup = async (fileText: string) => {
    const check = validateBackupPayload(fileText);
    if (check.ok === false) {
      return { ok: false as const, error: check.error };
    }
    const result = await restoreFullBackup(check.payload);
    await refreshData();
    return {
      ok: true as const,
      setsRestored: result.setsRestored,
      sessionsRestored: result.sessionsRestored,
    };
  };

  const handleReattemptFullSet = (set: QuestionSet) => {
    setView({
      kind: 'exam',
      set,
      config: {
        timerMode: 'stopwatch',
        countdownMinutes: Math.max(1, set.questions.length * 2),
        shuffleQuestions: false,
        shuffleOptions: false,
      },
    });
  };

  const handleReattemptMistakes = (set: QuestionSet, subsetIndices: number[]) => {
    if (subsetIndices.length === 0) return;
    setView({
      kind: 'exam',
      set,
      config: {
        timerMode: 'stopwatch',
        countdownMinutes: Math.max(1, subsetIndices.length * 2),
        shuffleQuestions: false,
        shuffleOptions: false,
        subsetIndices,
      },
    });
  };

  return (
    <>
      {view.kind === 'dashboard' && (
        <Dashboard
          questionSets={questionSets}
          sessions={sessions}
          isLoading={isLoading}
          onOpenPasteModal={() => setIsPasteModalOpen(true)}
          onImportSet={handleImportSet}
          onDeleteSet={handleDeleteSet}
          onStartConfigure={(set) => setConfiguringSet(set)}
          onLoadBuiltInDemo={handleLoadBuiltInDemo}
          onOpenSessionReport={(session) => setView({ kind: 'analytics', session })}
          onDeleteSession={handleDeleteSession}
          onExportAllBackup={handleExportAllBackup}
          onRestoreAllBackup={handleRestoreAllBackup}
        />
      )}

      {view.kind === 'exam' && (
        <ExamInterface
          questionSet={view.set}
          config={view.config}
          onCompleteSession={handleCompleteSession}
          onAbortExam={() => setView({ kind: 'dashboard' })}
        />
      )}

      {view.kind === 'analytics' && (
        <AnalyticsScreen
          session={view.session}
          allSessions={sessions}
          sourceSet={questionSets.find((s) => s.id === view.session.setId)}
          onBackToDashboard={() => setView({ kind: 'dashboard' })}
          onSelectSession={(selected) => setView({ kind: 'analytics', session: selected })}
          onReattemptFullSet={handleReattemptFullSet}
          onReattemptMistakes={handleReattemptMistakes}
        />
      )}

      <ImportModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImportSuccess={handleImportSet}
      />

      <PreTestModal
        questionSet={configuringSet}
        onClose={() => setConfiguringSet(null)}
        onStartExam={handleStartExam}
      />

      <OfflineIndicator />
    </>
  );
}
