import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import {
  getUser, updateUserSetting, addMessage, getRecentMessages,
  getDueWords, getAllWords, saveWordReview, getUserStats
} from './database.js';
import { processUserMessage } from './teachingEngine.js';
import { generateTTSAudio } from './ttsService.js';
import { transcribeAudioWithWhisper } from './groqClient.js';
import { getAllLanguages } from './languages.js';
import { getAllThemes } from './themes.js';
import { getCurriculumCatalog, fetchAndParseLesson } from './gdriveCurriculum.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Serve static files for Mini App
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'fluence-bot-api' });
  });

  // API: Get user profile & stats
  app.get('/api/user', (req, res) => {
    const userId = parseInt(req.query.user_id || '856614939', 10);
    const user = getUser(userId, 'user', 'Learner');
    const stats = getUserStats(userId);
    res.json({ user, stats });
  });

  // API: Update user setting
  app.post('/api/user/settings', (req, res) => {
    const { user_id, setting, value } = req.body;
    if (user_id && setting) {
      updateUserSetting(user_id, setting, value);
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'Missing parameters' });
  });

  // API: Chat Turn
  app.post('/api/chat', async (req, res) => {
    try {
      const { user_id, message, language, level, theme } = req.body;
      const userId = parseInt(user_id || '856614939', 10);
      const user = getUser(userId, 'user', 'Learner');

      // Update settings if passed
      if (language && language !== user.learning_lang) updateUserSetting(userId, 'learning_lang', language);
      if (level && level !== user.level) updateUserSetting(userId, 'level', level);
      if (theme && theme !== user.current_theme) updateUserSetting(userId, 'current_theme', theme);

      // Save user message
      addMessage(userId, 'user', message, language || user.learning_lang, theme || user.current_theme);

      // Get conversation history
      const history = getRecentMessages(userId, 8);

      // Generate teacher response
      const teacherResponse = await processUserMessage(user, message, history);

      // Save teacher message
      addMessage(userId, 'assistant', teacherResponse.reply, language || user.learning_lang, theme || user.current_theme);

      res.json(teacherResponse);
    } catch (err) {
      console.error('API /api/chat error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // API: Transcribe audio
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { language, user_id } = req.body;
      // In web app, we can transcribe directly or fallback
      const sampleText = language === 'de' ? "Guten Tag! Ich möchte mein Deutsch verbessern." : "Hello! I am practicing.";
      res.json({ text: sampleText });
    } catch (err) {
      res.status(500).json({ error: 'Transcription failed' });
    }
  });

  // API: TTS Audio Stream
  app.get('/api/tts', async (req, res) => {
    try {
      const text = req.query.text || 'Guten Tag!';
      const lang = req.query.lang || 'de';

      const audioBuffer = await generateTTSAudio(text, lang);
      if (!audioBuffer) {
        return res.status(500).send('TTS generation failed');
      }

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length,
        'Cache-Control': 'public, max-age=86400'
      });
      res.send(audioBuffer);
    } catch (err) {
      console.error('API /api/tts error:', err);
      res.status(500).send('Error');
    }
  });

  // API: Get SRS due words & all vocabulary
  app.get('/api/srs/words', (req, res) => {
    const userId = parseInt(req.query.user_id || '856614939', 10);
    const language = req.query.language || 'de';

    const dueWords = getDueWords(userId, language, 30);
    const allWords = getAllWords(userId, language);

    res.json({
      dueWords,
      allWords,
      totalWords: allWords.length
    });
  });

  // API: Grade SRS word
  app.post('/api/srs/review', (req, res) => {
    const { user_id, word_id, grade } = req.body;
    if (user_id && word_id && grade) {
      saveWordReview(user_id, word_id, parseInt(grade, 10));
      return res.json({ success: true });
    }
    res.status(400).json({ error: 'Missing parameters' });
  });

  // API: FSRS Sync from iOS App / Web / Hermes VPS
  let vpsFSRSStore = {
    profile: {
      targetLanguage: 'de',
      nativeLanguage: 'fr',
      cefrLevel: 'B2',
      interests: ['Médecine', 'Neurologie', 'Conversation'],
      focusAreas: ['Allemand Médical (Assistenzarzt)', 'Subordonnées (weil, obwohl, dass)', 'Passif & Konjunktiv II'],
      fsrsRetentionRate: 0.90,
      totalSpokenMinutes: 0
    },
    fsrsItems: [],
    fsrsParams: {
      w: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 0.22695, 0.2315, 2.9898],
      targetRetention: 0.90,
      maximumIntervalDays: 365.0,
      totalReviewsCount: 0
    }
  };

  app.post('/api/fsrs/sync', (req, res) => {
    try {
      const payload = req.body;
      if (payload) {
        if (payload.profile) vpsFSRSStore.profile = { ...vpsFSRSStore.profile, ...payload.profile };
        if (payload.fsrsParams) vpsFSRSStore.fsrsParams = payload.fsrsParams;
        if (Array.isArray(payload.fsrsItems)) {
          const itemMap = new Map();
          vpsFSRSStore.fsrsItems.forEach(it => itemMap.set(it.term.toLowerCase(), it));
          payload.fsrsItems.forEach(it => {
            const existing = itemMap.get(it.term.toLowerCase());
            if (!existing || (it.reps && it.reps > (existing.reps || 0))) {
              itemMap.set(it.term.toLowerCase(), it);
            }
          });
          vpsFSRSStore.fsrsItems = Array.from(itemMap.values());
        }
      }
      res.json({
        profile: vpsFSRSStore.profile,
        fsrsItems: vpsFSRSStore.fsrsItems,
        fsrsParams: vpsFSRSStore.fsrsParams,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('FSRS sync error:', err);
      res.status(500).json({ error: 'Sync failed' });
    }
  });

  app.get('/api/fsrs/due', (req, res) => {
    const language = req.query.language || 'de';
    const items = vpsFSRSStore.fsrsItems.filter(it => (it.languageID || 'de') === language);
    res.json({ dueItems: items.slice(0, 10), totalCount: items.length });
  });

  // API: Get Languages
  app.get('/api/languages', (req, res) => {
    res.json(getAllLanguages());
  });

  // API: Get Themes
  app.get('/api/themes', (req, res) => {
    res.json(getAllThemes());
  });

  // API: Google Drive Curriculum Catalog
  app.get('/api/curriculum', async (req, res) => {
    try {
      const catalog = await getCurriculumCatalog();
      res.json(catalog);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // API: Fetch & Parse Specific Lesson from Google Drive
  app.get('/api/curriculum/lesson', async (req, res) => {
    try {
      const { level, filename } = req.query;
      if (!level || !filename) {
        return res.status(400).json({ error: 'Missing level or filename' });
      }
      const lesson = await fetchAndParseLesson(level, filename);
      res.json(lesson);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return app;
}
