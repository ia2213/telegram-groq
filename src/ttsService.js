import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CONFIG } from './config.js';
import { getLanguage } from './languages.js';

// Ensure cache dir exists
if (!fs.existsSync(CONFIG.AUDIO_CACHE_DIR)) {
  fs.mkdirSync(CONFIG.AUDIO_CACHE_DIR, { recursive: true });
}

export async function generateTTSAudio(text, langId = 'de') {
  const langObj = getLanguage(langId);
  const ttsLang = langObj.ttsCode || 'de';

  // Sanitize text for TTS (remove markdown, HTML tags, emoji)
  const cleanText = text
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`~#\[\]()]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    .trim();

  if (!cleanText) return null;

  // Max 200 chars per chunk for reliable Google TTS endpoint
  const targetSnippet = cleanText.slice(0, 300);

  const hash = crypto.createHash('md5').update(`${ttsLang}:${targetSnippet}`).digest('hex');
  const cachePath = path.join(CONFIG.AUDIO_CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 500) {
    return fs.readFileSync(cachePath);
  }

  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(targetSnippet)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 500) {
        fs.writeFileSync(cachePath, buffer);
        return buffer;
      }
    }
  } catch (error) {
    console.error(`TTS Error for ${langId}:`, error);
  }

  return null;
}
