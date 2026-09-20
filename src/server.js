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
    res.json({ status: 'ok', service: 'mural-teacher-miniapp' });
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

  // API: Get Languages
  app.get('/api/languages', (req, res) => {
    res.json(getAllLanguages());
  });

  // API: Get Themes
  app.get('/api/themes', (req, res) => {
    res.json(getAllThemes());
  });

  return app;
}
