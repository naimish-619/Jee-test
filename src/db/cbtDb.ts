import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { createBuiltInDemoSet } from '../data/demoSets';
import type { BackupPayload, QuestionSet, SessionAttempt } from '../types/cbt';

interface JeeCbtDatabase extends DBSchema {
  questionSets: {
    key: string;
    value: QuestionSet;
    indexes: { 'by-subject': string; 'by-updated': number };
  };
  sessions: {
    key: string;
    value: SessionAttempt;
    indexes: { 'by-set': string; 'by-completed': number };
  };
  meta: {
    key: string;
    value: { key: string; value: unknown };
  };
}

const DB_NAME = 'jee-main-cbt-studio-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<JeeCbtDatabase>> | null = null;

function getDb(): Promise<IDBPDatabase<JeeCbtDatabase>> {
  if (!dbPromise) {
    dbPromise = openDB<JeeCbtDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('questionSets')) {
          const setStore = db.createObjectStore('questionSets', { keyPath: 'id' });
          setStore.createIndex('by-subject', 'subject');
          setStore.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('by-set', 'setId');
          sessionStore.createIndex('by-completed', 'completedAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function initializeDatabaseWithDemo(): Promise<void> {
  const db = await getDb();
  const seededFlag = await db.get('meta', 'demoSeeded');
  const existingSets = await db.getAll('questionSets');

  if (!seededFlag && existingSets.length === 0) {
    const demoSet = createBuiltInDemoSet();
    const tx = db.transaction(['questionSets', 'meta'], 'readwrite');
    await tx.objectStore('questionSets').put(demoSet);
    await tx.objectStore('meta').put({ key: 'demoSeeded', value: true });
    await tx.done;
  }
}

export async function loadBuiltInDemoSetToDb(): Promise<QuestionSet> {
  const db = await getDb();
  const demoSet = createBuiltInDemoSet();
  await db.put('questionSets', demoSet);
  await db.put('meta', { key: 'demoSeeded', value: true });
  return demoSet;
}

export async function getAllQuestionSets(): Promise<QuestionSet[]> {
  const db = await getDb();
  const sets = await db.getAll('questionSets');
  return sets.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveQuestionSet(set: QuestionSet): Promise<void> {
  const db = await getDb();
  await db.put('questionSets', set);
}

export async function deleteQuestionSet(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('questionSets', id);
}

export async function getAllSessions(): Promise<SessionAttempt[]> {
  const db = await getDb();
  const sessions = await db.getAll('sessions');
  return sessions.sort((a, b) => b.completedAt - a.completedAt);
}

export async function saveSessionAttempt(session: SessionAttempt): Promise<void> {
  const db = await getDb();
  await db.put('sessions', session);
}

export async function deleteSessionAttempt(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('sessions', id);
}

export async function exportFullBackup(): Promise<BackupPayload> {
  const [questionSets, sessions] = await Promise.all([getAllQuestionSets(), getAllSessions()]);
  return {
    version: 1,
    exportedAt: Date.now(),
    questionSets,
    sessions,
  };
}

export async function restoreFullBackup(payload: BackupPayload): Promise<{ setsRestored: number; sessionsRestored: number }> {
  const db = await getDb();
  const tx = db.transaction(['questionSets', 'sessions', 'meta'], 'readwrite');
  const setStore = tx.objectStore('questionSets');
  const sessionStore = tx.objectStore('sessions');

  for (const s of payload.questionSets) {
    await setStore.put(s);
  }
  for (const sess of payload.sessions) {
    await sessionStore.put(sess);
  }
  await tx.objectStore('meta').put({ key: 'demoSeeded', value: true });
  await tx.done;

  return {
    setsRestored: payload.questionSets.length,
    sessionsRestored: payload.sessions.length,
  };
}
