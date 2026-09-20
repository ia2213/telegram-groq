import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const CONFIG = {
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  DEFAULT_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  FALLBACK_MODELS: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
  ],
  LOCAL_API_URL: process.env.LOCAL_API_URL || 'http://localhost:20128/v1',
  LOCAL_API_KEY: process.env.LOCAL_API_KEY || process.env.HERMES_CUSTOM_LOCALHOST_20128_API_KEY || '',
  LOCAL_API_MODEL: process.env.LOCAL_API_MODEL || 'auto/fast',
  PORT: parseInt(process.env.PORT || '3000', 10),
  WEBAPP_URL: process.env.WEBAPP_URL || '',
  DB_PATH: path.resolve(__dirname, '../mural_bot.db'),
  AUDIO_CACHE_DIR: path.resolve(__dirname, '../cache/audio'),
  DEFAULT_LANGUAGE: 'de', // German default
  DEFAULT_LEVEL: 'B2',
  DEFAULT_THEME: 'free_talk'
};
