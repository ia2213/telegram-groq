import Database from 'better-sqlite3';
import { CONFIG } from './config.js';

let dbInstance = null;

export function getDb() {
  if (!dbInstance) {
    dbInstance = new Database(CONFIG.DB_PATH);
    dbInstance.pragma('journal_mode = WAL');
    initDb(dbInstance);
  }
  return dbInstance;
}

function initDb(db) {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      learning_lang TEXT DEFAULT 'de',
      support_lang TEXT DEFAULT 'fr',
      level TEXT DEFAULT 'B2',
      current_theme TEXT DEFAULT 'free_talk',
      groq_api_key TEXT,
      groq_model TEXT DEFAULT 'llama-3.3-70b-versatile',
      auto_audio INTEGER DEFAULT 0,
      show_subtitles INTEGER DEFAULT 1,
      speech_speed REAL DEFAULT 1.0,
      created_at TEXT,
      last_active TEXT
    );
  `);

  // Conversations history table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      role TEXT,
      content TEXT,
      language TEXT,
      theme TEXT,
      created_at TEXT
    );
  `);

  // Vocabulary Spaced Repetition (SRS)
  db.exec(`
    CREATE TABLE IF NOT EXISTS vocabulary_srs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      language TEXT,
      word TEXT,
      translation_fr TEXT,
      example_sentence TEXT,
      interval INTEGER DEFAULT 1,
      ease_factor REAL DEFAULT 2.5,
      repetitions INTEGER DEFAULT 0,
      due_date TEXT,
      last_reviewed TEXT,
      UNIQUE(user_id, language, word)
    );
  `);

  // User Stats & Streaks
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id INTEGER PRIMARY KEY,
      streak_days INTEGER DEFAULT 0,
      last_streak_date TEXT,
      messages_count INTEGER DEFAULT 0,
      words_learned INTEGER DEFAULT 0,
      audio_seconds INTEGER DEFAULT 0
    );
  `);
}

export function getUser(userId, username = '', firstName = '') {
  const db = getDb();
  let user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);

  const now = new Date().toISOString();
  if (!user) {
    db.prepare(`
      INSERT INTO users (user_id, username, first_name, learning_lang, support_lang, level, current_theme, groq_model, auto_audio, show_subtitles, speech_speed, created_at, last_active)
      VALUES (?, ?, ?, 'de', 'fr', 'B2', 'free_talk', 'llama-3.3-70b-versatile', 0, 1, 1.0, ?, ?)
    `).run(userId, username || '', firstName || '', now, now);

    db.prepare(`
      INSERT INTO user_stats (user_id, streak_days, last_streak_date, messages_count, words_learned, audio_seconds)
      VALUES (?, 0, '', 0, 0, 0)
    `).run(userId);

    user = db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId);
  } else {
    db.prepare('UPDATE users SET last_active = ?, username = ?, first_name = ? WHERE user_id = ?')
      .run(now, username || user.username, firstName || user.first_name, userId);
  }

  return user;
}

export function updateUserSetting(userId, key, value) {
  const db = getDb();
  const allowed = [
    'learning_lang', 'support_lang', 'level', 'current_theme', 
    'groq_api_key', 'groq_model', 'auto_audio', 'show_subtitles', 'speech_speed'
  ];
  if (!allowed.includes(key)) return;

  db.prepare(`UPDATE users SET ${key} = ? WHERE user_id = ?`).run(value, userId);
}

export function addMessage(userId, role, content, language, theme) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO conversations (user_id, role, content, language, theme, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, role, content, language, theme, now);

  // Update messages count and streak
  incrementUserActivity(userId);
}

export function getRecentMessages(userId, language, limit = 8) {
  const db = getDb();
  return db.prepare(`
    SELECT role, content, created_at 
    FROM conversations 
    WHERE user_id = ? AND language = ?
    ORDER BY id DESC 
    LIMIT ?
  `).all(userId, language, limit).reverse();
}

export function clearConversation(userId, language) {
  const db = getDb();
  db.prepare('DELETE FROM conversations WHERE user_id = ? AND language = ?').run(userId, language);
}

export function addOrUpdateWord(userId, language, word, translationFr, example = '') {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    INSERT INTO vocabulary_srs (user_id, language, word, translation_fr, example_sentence, interval, ease_factor, repetitions, due_date, last_reviewed)
    VALUES (?, ?, ?, ?, ?, 1, 2.5, 0, ?, ?)
    ON CONFLICT(user_id, language, word) DO UPDATE SET
      translation_fr = excluded.translation_fr,
      example_sentence = CASE WHEN excluded.example_sentence != '' THEN excluded.example_sentence ELSE example_sentence END
  `).run(userId, language, word.trim(), translationFr.trim(), example.trim(), today, today);

  const count = db.prepare('SELECT COUNT(*) as c FROM vocabulary_srs WHERE user_id = ?').get(userId).c;
  db.prepare('UPDATE user_stats SET words_learned = ? WHERE user_id = ?').run(count, userId);
}

export function getDueWords(userId, language, limit = 10) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT * FROM vocabulary_srs 
    WHERE user_id = ? AND language = ? AND (due_date <= ? OR due_date IS NULL)
    ORDER BY due_date ASC 
    LIMIT ?
  `).all(userId, language, today, limit);
}

export function getAllWords(userId, language) {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM vocabulary_srs 
    WHERE user_id = ? AND language = ?
    ORDER BY id DESC
  `).all(userId, language);
}

export function saveWordReview(userId, wordId, newInterval, newEase, newReps, dueDate) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  db.prepare(`
    UPDATE vocabulary_srs 
    SET interval = ?, ease_factor = ?, repetitions = ?, due_date = ?, last_reviewed = ?
    WHERE id = ? AND user_id = ?
  `).run(newInterval, newEase, newReps, dueDate, today, wordId, userId);

  incrementUserActivity(userId);
}

export function getUserStats(userId) {
  const db = getDb();
  let stats = db.prepare('SELECT * FROM user_stats WHERE user_id = ?').get(userId);
  if (!stats) {
    stats = { streak_days: 0, last_streak_date: '', messages_count: 0, words_learned: 0, audio_seconds: 0 };
  }
  return stats;
}

function incrementUserActivity(userId) {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const stats = getUserStats(userId);

  let newStreak = stats.streak_days || 0;
  if (stats.last_streak_date !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (stats.last_streak_date === yesterday) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  db.prepare(`
    UPDATE user_stats 
    SET messages_count = messages_count + 1,
        streak_days = ?,
        last_streak_date = ?
    WHERE user_id = ?
  `).run(newStreak, today, userId);
}
