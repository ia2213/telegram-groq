import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import util from 'util';
import { CONFIG } from './config.js';
import { getLanguage } from './languages.js';

const execFilePromise = util.promisify(execFile);

// Ensure cache dir exists
if (!fs.existsSync(CONFIG.AUDIO_CACHE_DIR)) {
  fs.mkdirSync(CONFIG.AUDIO_CACHE_DIR, { recursive: true });
}

export const NEURAL_VOICES = {
  de: [
    { id: 'de-DE-KillianNeural', name: '👨🏫 Killian (Homme - Naturel & Chaleureux)', gender: 'male', isDefault: true },
    { id: 'de-DE-KatjaNeural', name: '👩🏫 Katja (Femme - Claire & Expressive)', gender: 'female' },
    { id: 'de-DE-ConradNeural', name: '🎙️ Conrad (Homme - Posé & Pédagogique)', gender: 'male' },
    { id: 'de-DE-SeraphinaMultilingualNeural', name: '🌟 Seraphina (Femme - Ultra-réaliste)', gender: 'female' },
    { id: 'de-DE-FlorianMultilingualNeural', name: '⚡ Florian (Homme - Dynamique)', gender: 'male' },
    { id: 'de-DE-AmalaNeural', name: '🌸 Amala (Femme - Douce)', gender: 'female' }
  ],
  fr: [
    { id: 'fr-FR-RemyMultilingualNeural', name: '👨 Remy (Homme - Studio)', gender: 'male', isDefault: true },
    { id: 'fr-FR-VivienneMultilingualNeural', name: '👩 Vivienne (Femme - Studio)', gender: 'female' },
    { id: 'fr-FR-HenriNeural', name: '🎙️ Henri (Homme - Expressif)', gender: 'male' },
    { id: 'fr-FR-DeniseNeural', name: '🌸 Denise (Femme - Douce)', gender: 'female' }
  ],
  en: [
    { id: 'en-US-BrianMultilingualNeural', name: '👨 Brian (Homme - US Naturel)', gender: 'male', isDefault: true },
    { id: 'en-US-EmmaMultilingualNeural', name: '👩 Emma (Femme - US Expressive)', gender: 'female' },
    { id: 'en-GB-RyanNeural', name: '🇬🇧 Ryan (Homme - British)', gender: 'male' },
    { id: 'en-GB-SoniaNeural', name: '🇬🇧 Sonia (Femme - British)', gender: 'female' },
    { id: 'en-US-GuyNeural', name: '🎙️ Guy (Homme - Posé)', gender: 'male' }
  ],
  es: [
    { id: 'es-ES-AlvaroNeural', name: '🇪🇸 Alvaro (Homme - Espagne)', gender: 'male', isDefault: true },
    { id: 'es-ES-ElviraNeural', name: '🇪🇸 Elvira (Femme - Espagne)', gender: 'female' },
    { id: 'es-MX-JorgeNeural', name: '🇲🇽 Jorge (Homme - Mexique)', gender: 'male' },
    { id: 'es-MX-DaliaNeural', name: '🇲🇽 Dalia (Femme - Mexique)', gender: 'female' }
  ],
  it: [
    { id: 'it-IT-GiuseppeMultilingualNeural', name: '👨 Giuseppe (Homme - Studio)', gender: 'male', isDefault: true },
    { id: 'it-IT-ElsaNeural', name: '👩 Elsa (Femme - Claire)', gender: 'female' },
    { id: 'it-IT-DiegoNeural', name: '🎙️ Diego (Homme - Posé)', gender: 'male' },
    { id: 'it-IT-IsabellaNeural', name: '🌸 Isabella (Femme - Douce)', gender: 'female' }
  ],
  pt: [
    { id: 'pt-BR-AntonioNeural', name: '🇧🇷 Antonio (Homme - Brésil)', gender: 'male', isDefault: true },
    { id: 'pt-BR-FranciscaNeural', name: '🇧🇷 Francisca (Femme - Brésil)', gender: 'female' },
    { id: 'pt-PT-DuarteNeural', name: '🇵🇹 Duarte (Homme - Portugal)', gender: 'male' },
    { id: 'pt-PT-RaquelNeural', name: '🇵🇹 Raquel (Femme - Portugal)', gender: 'female' }
  ],
  ar: [
    { id: 'ar-SA-HamedNeural', name: '🇸🇦 Hamed (Homme - Arabie)', gender: 'male', isDefault: true },
    { id: 'ar-SA-ZariyahNeural', name: '🇸🇦 Zariyah (Femme - Arabie)', gender: 'female' },
    { id: 'ar-EG-ShakirNeural', name: '🇪🇬 Shakir (Homme - Égypte)', gender: 'male' },
    { id: 'ar-EG-SalmaNeural', name: '🇪🇬 Salma (Femme - Égypte)', gender: 'female' }
  ],
  ru: [
    { id: 'ru-RU-DmitryNeural', name: '👨 Dmitry (Homme - Studio)', gender: 'male', isDefault: true },
    { id: 'ru-RU-SvetlanaNeural', name: '👩 Svetlana (Femme - Claire)', gender: 'female' }
  ],
  ja: [
    { id: 'ja-JP-KeitaNeural', name: '👨 Keita (Homme - Studio)', gender: 'male', isDefault: true },
    { id: 'ja-JP-NanamiNeural', name: '👩 Nanami (Femme - Douce)', gender: 'female' }
  ],
  zh: [
    { id: 'zh-CN-YunxiNeural', name: '👨 Yunxi (Homme - Mandarin)', gender: 'male', isDefault: true },
    { id: 'zh-CN-XiaoxiaoNeural', name: '👩 Xiaoxiao (Femme - Mandarin)', gender: 'female' }
  ],
  'zh-CN': [
    { id: 'zh-CN-YunxiNeural', name: '👨 Yunxi (Homme - Mandarin)', gender: 'male', isDefault: true },
    { id: 'zh-CN-XiaoxiaoNeural', name: '👩 Xiaoxiao (Femme - Mandarin)', gender: 'female' }
  ],
  no: [
    { id: 'nb-NO-FinnNeural', name: '👨 Finn (Homme - Norvégien)', gender: 'male', isDefault: true },
    { id: 'nb-NO-PernilleNeural', name: '👩 Pernille (Femme - Norvégien)', gender: 'female' }
  ],
  ro: [
    { id: 'ro-RO-EmilNeural', name: '👨 Emil (Homme - Roumain)', gender: 'male', isDefault: true },
    { id: 'ro-RO-AlinaNeural', name: '👩 Alina (Femme - Roumain)', gender: 'female' }
  ]
};

export function getDefaultVoiceForLang(langId = 'de') {
  const list = NEURAL_VOICES[langId] || NEURAL_VOICES['de'];
  const def = list.find(v => v.isDefault) || list[0];
  return def.id;
}

export async function generateTTSAudio(text, langId = 'de', customVoice = null, rate = '+0%') {
  const langObj = getLanguage(langId);
  const voice = customVoice || getDefaultVoiceForLang(langId);

  // Sanitize text for TTS: remove markdown, translation notes, bracketed translations, emojis
  let cleanText = text
    .replace(/\[FSRS_REVIEW:[^\]]*\]/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[.*?\]/g, '') // remove bracketed French notes like [traduction = ...]
    .replace(/[*_`~#]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '')
    .trim();

  if (!cleanText) return null;

  // Truncate to reasonable speaking length (up to 1500 chars for neural speech)
  const targetSnippet = cleanText.slice(0, 1500);

  const hash = crypto.createHash('md5').update(`${voice}:${rate}:${targetSnippet}`).digest('hex');
  const cachePath = path.join(CONFIG.AUDIO_CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 500) {
    return fs.readFileSync(cachePath);
  }

  try {
    const runnerPath = path.join(path.dirname(new URL(import.meta.url).pathname), 'edge_runner.py');
    await execFilePromise('python3', [runnerPath, targetSnippet, voice, cachePath, rate]);

    if (fs.existsSync(cachePath) && fs.statSync(cachePath).size > 500) {
      return fs.readFileSync(cachePath);
    }
  } catch (err) {
    console.error(`Edge-TTS Error for ${voice}:`, err.message);
  }

  // Fallback to Google Translate if offline
  try {
    const ttsLang = langObj.ttsCode || 'de';
    const fallbackSnippet = targetSnippet.slice(0, 250);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(fallbackSnippet)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 500) {
        fs.writeFileSync(cachePath, buffer);
        return buffer;
      }
    }
  } catch (error) {
    console.error(`Fallback TTS Error:`, error);
  }

  return null;
}
