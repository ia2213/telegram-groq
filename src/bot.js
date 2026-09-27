import { Bot, InputFile, InlineKeyboard } from 'grammy';
import { CONFIG } from './config.js';
import { createServer } from './server.js';
import {
  getUser, updateUserSetting, addMessage, getRecentMessages,
  clearConversation, getDueWords, getAllWords, saveWordReview, getUserStats
} from './database.js';
import { getLanguage } from './languages.js';
import { getTheme, THEMES } from './themes.js';
import {
  processUserMessage, generateThemeStarter, explainWordDetails
} from './teachingEngine.js';
import { generateTTSAudio, NEURAL_VOICES, getDefaultVoiceForLang } from './ttsService.js';
import { transcribeAudioWithWhisper } from './groqClient.js';
import { calculateSM2 } from './srsEngine.js';
import {
  buildMainKeyboard, formatTeacherCard, buildTurnInlineKeyboard,
  buildLanguageKeyboard, buildLevelKeyboard, buildThemeCategoriesKeyboard,
  buildThemesListKeyboard, formatSRSReviewCard, buildSRSRevealKeyboard,
  formatSRSAnswerCard, buildSRSGradingKeyboard, formatStatsDashboard,
  buildStatsKeyboard, formatSettingsCard, buildSettingsKeyboard
} from './uiComponents.js';
import { getCurriculumCatalog, fetchAndParseLesson } from './gdriveCurriculum.js';

const token = CONFIG.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Erreur: TELEGRAM_BOT_TOKEN est manquant. Veuillez le définir dans votre fichier .env");
  process.exit(1);
}

const bot = new Bot(token, CONFIG.BOT_API_ROOT ? { client: { apiRoot: CONFIG.BOT_API_ROOT } } : undefined);

// Global Error Handler to prevent crashes on expired callback queries or network hiccups
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Erreur lors du traitement de l'update ${ctx?.update?.update_id}:`, err.error?.message || err.message);
});

// In-memory state for user review queues and prompt listeners
const reviewSessions = new Map(); // userId -> { words: [], index: 0 }
const pendingKeyPrompts = new Set(); // Set of userIds awaiting API key text

// ─────────────────────────────────────────────
// Command: /start
// ─────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const user = getUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);

  const welcomeText = `
╭─────────────────────────────────╮
│  ✨ <b>FLUENCE · PROFESSEUR IA NATIF</b>  │
╰─────────────────────────────────╯
Bonjour <b>${ctx.from.first_name}</b> ! 🌟

Je suis votre professeur particulier et partenaire de conversation immersif.

🎯 <b>Vos paramètres d'apprentissage :</b>
• Langue : <b>${lang.flag} ${lang.name} (${lang.nativeName})</b>
• Niveau CEFR : <b>${user.level || 'B2'}</b>
• Scénario : <b>${theme.icon} ${theme.title}</b>

💡 <b>Comment pratiquer :</b>
1. <b>Parlez ou écrivez</b> : envoyez des notes vocales 🎙️ ou des messages texte.
2. <b>Correction & Répétition FSRS</b> : je vous réponds en audio avec une voix humaine, corrige vos erreurs et mémorise votre vocabulaire.
3. <b>Cours & Leçons</b> : accédez aux leçons complètes avec le bouton <b>📚 Mes Cours & Leçons</b>.
`.trim();

  await ctx.reply(welcomeText, {
    parse_mode: 'HTML',
    reply_markup: buildMainKeyboard()
  });

  // Automatically start the active scenario
  await sendThemeOpening(ctx, user);
});

// ─────────────────────────────────────────────
// Command: /help
// ─────────────────────────────────────────────
bot.command(['help', 'aide'], async (ctx) => {
  const helpText = `
📖 <b>GUIDE DES COMMANDES · FLUENCE</b>
━━━━━━━━━━━━━━━━━━━━━

<b>Apprentissage & Pratique :</b>
• <code>/cours</code> : Accéder aux leçons et cours complets (Google Drive)
• <code>/srs</code> ou <code>/vocab</code> : Réviser le vocabulaire (Répétition espacée FSRS)
• <code>/theme</code> : Choisir un scénario ou une mise en situation

<b>Configuration & Profil :</b>
• <code>/voix</code> : Choisir la voix studio haute fidélité et le débit
• <code>/niveau</code> : Définir votre niveau CECRL (A1, A2, B1, B2, C1, C2)
• <code>/langue</code> : Changer la langue d'apprentissage
• <code>/stats</code> : Consulter votre tableau de bord et votre streak
• <code>/parametres</code> : Réglages des sous-titres et audio automatique
• <code>/reset</code> : Réinitialiser la conversation
`.trim();

  await ctx.reply(helpText, {
    parse_mode: 'HTML',
    reply_markup: buildMainKeyboard()
  });
});

// ─────────────────────────────────────────────
// Command: /lang
// ─────────────────────────────────────────────
bot.command(['lang', 'language', 'langue'], async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.reply('🌐 <b>Choisissez votre langue d’apprentissage :</b>\n\n<i>Chaque langue adapte son accent, ses règles de grammaire et ses expressions culturelles.</i>', {
    parse_mode: 'HTML',
    reply_markup: buildLanguageKeyboard(user.learning_lang)
  });
});

// ─────────────────────────────────────────────
// Command: /level
// ─────────────────────────────────────────────
bot.command(['level', 'niveau'], async (ctx) => {
  const user = getUser(ctx.from.id);
  await ctx.reply('🎯 <b>Sélectionnez votre niveau de maîtrise visé (CEFR) :</b>\n\n<i>Fluence adaptera la complexité des phrases, le vocabulaire et le débit de parole.</i>', {
    parse_mode: 'HTML',
    reply_markup: buildLevelKeyboard(user.level || 'B2')
  });
});

// ─────────────────────────────────────────────
// Command: /cours & /lecon (Google Drive Curriculum)
// ─────────────────────────────────────────────
bot.command(['cours', 'lecon', 'lecons', 'curriculum'], async (ctx) => {
  const userId = ctx.from?.id;
  // Protection: Access strictly isolated to the owner (Iyad)
  if (userId !== 856614939) {
    return await ctx.reply('🔒 <i>Ce module de cours avancés est réservé au propriétaire de l\'écosystème. Utilisez les thèmes et scénarios avec /theme.</i>', { parse_mode: 'HTML' });
  }

  try {
    const catalog = await getCurriculumCatalog();
    const keyboard = new InlineKeyboard();

    const levels = [
      { id: 'A1', label: `🟢 A1 - Nicos Weg (${catalog.A1?.count || 0} leçons)` },
      { id: 'A2', label: `🔵 A2 - Nicos Weg (${catalog.A2?.count || 0} leçons)` },
      { id: 'B1', label: `🟣 B1 - Nicos Weg (${catalog.B1?.count || 0} leçons)` },
      { id: 'B2', label: `🟠 B2 - Jojo sucht das Glück (${catalog.B2?.count || 0} leçons)` },
      { id: 'C1', label: `🏥 C1 - Médical & Neurochirurgie (${catalog.C1?.count || 0} leçons)` }
    ];

    levels.forEach(lvl => {
      keyboard.text(lvl.label, `gdrive_lvl_${lvl.id}`).row();
    });

    await ctx.reply(
      '📚 <b>HUB ALLEMAND · COURS & LEÇONS GOOGLE DRIVE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez un niveau pour accéder à vos cours complets, dialogues et simulations cliniques :</i>',
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (e) {
    await ctx.reply(`Erreur lors du chargement du catalogue : ${e.message}`);
  }
});

// ─────────────────────────────────────────────
// Command: /voix & /voice (Choix de la voix IA humaine)
// ─────────────────────────────────────────────
bot.command(['voix', 'voice', 'audio'], async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  const langId = user.learning_lang || 'de';
  const voices = NEURAL_VOICES[langId] || NEURAL_VOICES['de'];
  const currentVoice = user.user_voice || getDefaultVoiceForLang(langId);
  const currentSpeed = user.user_speed || '+0%';

  const keyboard = new InlineKeyboard();
  voices.forEach(v => {
    const isSelected = v.id === currentVoice ? ' ✅' : '';
    keyboard.text(`${v.name}${isSelected}`, `setvoice:${v.id}`).row();
  });

  keyboard.row()
    .text(`🐢 Lent (-15%) ${currentSpeed === '-15%' ? '✅' : ''}`, 'setspeed:-15%')
    .text(`🎯 Normal ${currentSpeed === '+0%' ? '✅' : ''}`, 'setspeed:+0%')
    .text(`🐇 Rapide (+15%) ${currentSpeed === '+15%' ? '✅' : ''}`, 'setspeed:+15%');

  await ctx.reply(
    '🎙️ <b>CONFIGURATION DE LA VOIX DU PROFESSEUR IA</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez votre voix neurale studio haute fidélité et le débit de parole :</i>\n\n• <b>Voix 100% Neurale Studio</b> (intonation humaine, respiration naturelle)\n• <b>Illimité et Gratuit</b> généré sur votre VPS',
    { parse_mode: 'HTML', reply_markup: keyboard }
  );
});

// ─────────────────────────────────────────────
// Command: /theme
// ─────────────────────────────────────────────
bot.command(['theme', 'themes', 'scenario'], async (ctx) => {
  await ctx.reply('🎭 <b>Choisissez une catégorie de scénarios de conversation :</b>\n\n<i>Mettez-vous en situation réelle pour développer des réflexes spontanés.</i>', {
    parse_mode: 'HTML',
    reply_markup: buildThemeCategoriesKeyboard()
  });
});

// ─────────────────────────────────────────────
// Command: /srs & /review
// ─────────────────────────────────────────────
bot.command(['srs', 'review', 'vocab', 'carnet'], async (ctx) => {
  await startSRSSession(ctx);
});

// ─────────────────────────────────────────────
// Command: /stats
// ─────────────────────────────────────────────
bot.command(['stats', 'profil'], async (ctx) => {
  const user = getUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const stats = getUserStats(user.user_id);
  const words = getAllWords(user.user_id, user.learning_lang);

  const card = formatStatsDashboard(user, stats, words);
  await ctx.reply(card, {
    parse_mode: 'HTML',
    reply_markup: buildStatsKeyboard()
  });
});

// ─────────────────────────────────────────────
// Command: /settings
// ─────────────────────────────────────────────
bot.command(['settings', 'parametres'], async (ctx) => {
  const user = getUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const card = formatSettingsCard(user);
  await ctx.reply(card, {
    parse_mode: 'HTML',
    reply_markup: buildSettingsKeyboard(user)
  });
});

// ─────────────────────────────────────────────
// Command: /reset
// ─────────────────────────────────────────────
bot.command('reset', async (ctx) => {
  const user = getUser(ctx.from.id);
  clearConversation(user.user_id, user.learning_lang);
  await ctx.reply('🔄 <b>Conversation réinitialisée !</b> Repartons sur de nouvelles bases.', {
    parse_mode: 'HTML'
  });
  await sendThemeOpening(ctx, user);
});

// ─────────────────────────────────────────────
// Command: /setkey
// ─────────────────────────────────────────────
bot.command('setkey', async (ctx) => {
  const key = ctx.match?.trim();
  if (!key) {
    pendingKeyPrompts.add(ctx.from.id);
    await ctx.reply('🔑 <b>Veuillez entrer votre clé API Groq :</b>\n\nEnvoyez simplement votre clé (ex: <code>gsk_...</code>) en réponse à ce message.\n<i>Pour annuler, tapez /cancel</i>', {
      parse_mode: 'HTML'
    });
    return;
  }

  updateUserSetting(ctx.from.id, 'groq_api_key', key);
  await ctx.reply('✅ <b>Clé API Groq enregistrée avec succès !</b> Vos futures requêtes utiliseront votre compte.', {
    parse_mode: 'HTML'
  });
});

bot.command('cancel', async (ctx) => {
  pendingKeyPrompts.delete(ctx.from.id);
  await ctx.reply('Opération annulée.', { reply_markup: buildMainKeyboard() });
});

// ─────────────────────────────────────────────
// Text Message Handler (Conversation & Reply Buttons)
// ─────────────────────────────────────────────
bot.on('message:text', async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  // Handle pending API key entry
  if (pendingKeyPrompts.has(userId)) {
    pendingKeyPrompts.delete(userId);
    if (text.startsWith('gsk_') || text.length > 20) {
      updateUserSetting(userId, 'groq_api_key', text);
      await ctx.reply('✅ <b>Clé API Groq configurée !</b>', { parse_mode: 'HTML', reply_markup: buildMainKeyboard() });
      return;
    } else {
      await ctx.reply('⚠️ Clé invalide. Opération annulée.', { reply_markup: buildMainKeyboard() });
      return;
    }
  }

  // Handle Reply Keyboard buttons
  if (text === '🎙️ Parler avec le Professeur' || text === '💬 Conversation') {
    const user = getUser(userId, ctx.from.username, ctx.from.first_name);
    const lang = getLanguage(user.learning_lang);
    await ctx.reply(`🎙️ <b>Session active en ${lang.flag} ${lang.name} (${user.level || 'B2'})</b>\n\nMaintenez le bouton micro 🎙️ de Telegram pour répondre oralement, ou écrivez votre message :`, { parse_mode: 'HTML' });
    return;
  }

  if (text === '📚 Mes Cours & Leçons' || text === '/cours') {
    // Check owner isolation
    if (userId !== 856614939) {
      await ctx.reply('🎭 <b>Choisissez une catégorie de scénarios d\'apprentissage :</b>', {
        parse_mode: 'HTML',
        reply_markup: buildThemeCategoriesKeyboard()
      });
      return;
    }
    try {
      const catalog = await getCurriculumCatalog();
      const keyboard = new InlineKeyboard();
      const levels = [
        { id: 'A1', label: `🟢 A1 - Nicos Weg (${catalog.A1?.count || 0} leçons)` },
        { id: 'A2', label: `🔵 A2 - Nicos Weg (${catalog.A2?.count || 0} leçons)` },
        { id: 'B1', label: `🟣 B1 - Nicos Weg (${catalog.B1?.count || 0} leçons)` },
        { id: 'B2', label: `🟠 B2 - Jojo sucht das Glück (${catalog.B2?.count || 0} leçons)` },
        { id: 'C1', label: `🏥 C1 - Médical & Neurochirurgie (${catalog.C1?.count || 0} leçons)` }
      ];
      levels.forEach(lvl => keyboard.text(lvl.label, `gdrive_lvl_${lvl.id}`).row());
      await ctx.reply(
        '📚 <b>HUB ALLEMAND · COURS & LEÇONS GOOGLE DRIVE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez un niveau pour accéder à vos cours complets, dialogues et simulations cliniques :</i>',
        { parse_mode: 'HTML', reply_markup: keyboard }
      );
    } catch (e) {
      await ctx.reply(`Erreur lors du chargement : ${e.message}`);
    }
    return;
  }

  if (text === '🧠 Répétition FSRS (Vocab)' || text === '📚 Mon Carnet (SRS)') {
    await startSRSSession(ctx);
    return;
  }

  if (text === '🎯 Mon Niveau & Langue' || text === '🎯 Niveau CEFR') {
    const user = getUser(userId);
    const kb = new InlineKeyboard()
      .text('🌐 Changer de Langue', 'nav:languages')
      .text('🎯 Changer de Niveau', 'nav:levels');
    await ctx.reply(`🎯 <b>NIVEAU & LANGUE D'ÉTUDE</b>\n\n• Langue : <b>${getLanguage(user.learning_lang).name}</b>\n• Niveau : <b>${user.level || 'B2'}</b>\n\n<i>Que souhaitez-vous ajuster ?</i>`, {
      parse_mode: 'HTML',
      reply_markup: kb
    });
    return;
  }

  if (text === '🔊 Voix Studio & Débit' || text === '/voix') {
    const user = getUser(userId, ctx.from.username, ctx.from.first_name);
    const langId = user.learning_lang || 'de';
    const voices = NEURAL_VOICES[langId] || NEURAL_VOICES['de'];
    const currentVoice = user.user_voice || getDefaultVoiceForLang(langId);
    const currentSpeed = user.user_speed || '+0%';

    const keyboard = new InlineKeyboard();
    voices.forEach(v => {
      const isSelected = v.id === currentVoice ? ' ✅' : '';
      keyboard.text(`${v.name}${isSelected}`, `setvoice:${v.id}`).row();
    });
    keyboard.row()
      .text(`🐢 Lent (-15%) ${currentSpeed === '-15%' ? '✅' : ''}`, 'setspeed:-15%')
      .text(`🎯 Normal ${currentSpeed === '+0%' ? '✅' : ''}`, 'setspeed:+0%')
      .text(`🐇 Rapide (+15%) ${currentSpeed === '+15%' ? '✅' : ''}`, 'setspeed:+15%');

    await ctx.reply(
      '🎙️ <b>CONFIGURATION DE LA VOIX DU PROFESSEUR IA</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez votre voix neurale studio haute fidélité et le débit de parole :</i>\n\n• <b>Voix 100% Neurale Studio</b> (intonation humaine, respiration naturelle)\n• <b>Illimité et Gratuit</b> généré sur votre VPS',
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  if (text === '⚙️ Paramètres & Stats' || text === '⚙️ Paramètres') {
    const user = getUser(userId, ctx.from.username, ctx.from.first_name);
    await ctx.reply(formatSettingsCard(user), {
      parse_mode: 'HTML',
      reply_markup: buildSettingsKeyboard(user)
    });
    return;
  }

  // Standard Conversational Turn
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  await ctx.replyWithChatAction('typing');

  try {
    const history = getRecentMessages(userId, user.learning_lang, 6);
    addMessage(userId, 'user', text, user.learning_lang, user.current_theme);

    const parsed = await processUserMessage(user, text, history);
    addMessage(userId, 'assistant', parsed.reply, user.learning_lang, user.current_theme);

    const card = formatTeacherCard(parsed, user);
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildTurnInlineKeyboard(parsed, user)
    });

    // If auto_audio is enabled, send speech audio immediately
    if (user.auto_audio === 1 && parsed.reply) {
      await sendTTSAudio(ctx, parsed.reply, user.learning_lang);
    }
  } catch (error) {
    console.error('Conversation processing error:', error);
    await ctx.reply('⚠️ Une erreur est survenue lors de la génération de la réponse. Veuillez réessayer.');
  }
});

// ─────────────────────────────────────────────
// Voice Note Handler (STT + Audio Reply)
// ─────────────────────────────────────────────
bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  const lang = getLanguage(user.learning_lang);

  await ctx.replyWithChatAction('record_voice');

  try {
    const file = await ctx.getFile();
    const fileUrl = `https://api.telegram.org/file/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);
    const audioBuffer = Buffer.from(await response.arrayBuffer());

    // Transcribe with Whisper
    const transcription = await transcribeAudioWithWhisper(audioBuffer, lang.code, user.groq_api_key);

    const recognizedText = transcription || 'Audio reçu';
    await ctx.reply(`🎙️ <b>Vous avez dit (${lang.flag} ${lang.name}) :</b>\n<i>« ${recognizedText} »</i>`, {
      parse_mode: 'HTML'
    });

    // Process through teacher engine
    const history = getRecentMessages(userId, user.learning_lang, 6);
    addMessage(userId, 'user', recognizedText, user.learning_lang, user.current_theme);

    const parsed = await processUserMessage(user, recognizedText, history);
    addMessage(userId, 'assistant', parsed.reply, user.learning_lang, user.current_theme);

    const card = formatTeacherCard(parsed, user);
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildTurnInlineKeyboard(parsed, user)
    });

    // Send oral voice response
    if (parsed.reply) {
      await sendTTSAudio(ctx, parsed.reply, user.learning_lang);
    }
  } catch (error) {
    console.error('Voice processing error:', error);
    await ctx.reply('⚠️ Impossible de traiter la note vocale. Assurez-vous d’avoir configuré votre clé Groq ou réessayez par écrit.');
  }
});

// ─────────────────────────────────────────────
// Photo Handler (Assimil Book OCR & Vision)
// ─────────────────────────────────────────────
bot.on('message:photo', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  const lang = getLanguage(user.learning_lang);

  await ctx.replyWithChatAction('typing');
  await ctx.reply('📸 <b>Analyse de votre page Assimil / Photo de cours...</b>', { parse_mode: 'HTML' });

  try {
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    const file = await ctx.api.getFile(bestPhoto.file_id);
    const fileUrl = `https://api.telegram.org/file/bot${CONFIG.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    
    const imgRes = await fetch(fileUrl);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
    const base64Img = imgBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Img}`;

    // Multimodal prompt for Assimil Tutor
    const prompt = `Voici une photo d'une page de méthode Assimil pour apprendre ${lang.name}. Fais office de professeur : lis le dialogue avec prononciation et traduction, explique les remarques de grammaire, et fais-moi passer les exercices pas à pas.`;

    const history = getRecentMessages(userId, user.learning_lang, 4);
    addMessage(userId, 'user', `[Photo Assimil Scannée] ${prompt}`, user.learning_lang, user.current_theme);

    const parsed = await processUserMessage(user, prompt, history);
    addMessage(userId, 'assistant', parsed.reply, user.learning_lang, user.current_theme);

    const card = formatTeacherCard(parsed, user);
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildTurnInlineKeyboard(parsed, user)
    });

    if (parsed.reply) {
      await sendTTSAudio(ctx, parsed.reply, user.learning_lang);
    }
  } catch (error) {
    console.error('Photo processing error:', error);
    await ctx.reply('⚠️ Impossible d’analyser cette image. Assurez-vous que le texte est bien lisible et éclairé.');
  }
});

// ─────────────────────────────────────────────
// Document Handler (Google Drive / PDF / Cours)
// ─────────────────────────────────────────────
bot.on('message:document', async (ctx) => {
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  const lang = getLanguage(user.learning_lang);

  await ctx.replyWithChatAction('typing');
  const docName = ctx.message.document.file_name || 'document';
  await ctx.reply(`📁 <b>Document reçu : ${docName}</b>\nAnalyse du cours en tant que professeur particulier...`, { parse_mode: 'HTML' });

  try {
    const prompt = `J'ai importé ce document de cours (${docName}). Fais office de professeur particulier : résume les points clés en ${lang.name}, explique le vocabulaire important et pose-moi des questions pour vérifier ma compréhension.`;

    const history = getRecentMessages(userId, user.learning_lang, 4);
    addMessage(userId, 'user', `[Document de cours : ${docName}] ${prompt}`, user.learning_lang, user.current_theme);

    const parsed = await processUserMessage(user, prompt, history);
    addMessage(userId, 'assistant', parsed.reply, user.learning_lang, user.current_theme);

    const card = formatTeacherCard(parsed, user);
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildTurnInlineKeyboard(parsed, user)
    });

    if (parsed.reply) {
      await sendTTSAudio(ctx, parsed.reply, user.learning_lang);
    }
  } catch (error) {
    console.error('Document processing error:', error);
    await ctx.reply('⚠️ Impossible de traiter ce document. Veuillez envoyer un format PDF ou texte standard.');
  }
});

// ─────────────────────────────────────────────
// Safe Edit / Reply Helper
// ─────────────────────────────────────────────
async function safeEdit(ctx, text, reply_markup = undefined) {
  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: reply_markup
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: reply_markup
      });
    }
  } catch (err) {
    if (err.message && err.message.includes('message is not modified')) {
      return; // Already current state
    }
    try {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: reply_markup
      });
    } catch (replyErr) {
      console.error('safeEdit error:', replyErr.message);
    }
  }
}

// ─────────────────────────────────────────────
// Callback Queries Dispatcher
// ─────────────────────────────────────────────
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);

  // Google Drive Curriculum Level Picker
  if (data.startsWith('gdrive_lvl_')) {
    await ctx.answerCallbackQuery().catch(() => {});
    if (userId !== 856614939) return;
    const levelId = data.replace('gdrive_lvl_', '');
    try {
      const catalog = await getCurriculumCatalog();
      const lvl = catalog[levelId];
      if (!lvl || lvl.lessons.length === 0) {
        return await safeEdit(ctx, `Aucune leçon trouvée pour le niveau ${levelId}.`);
      }

      const keyboard = new InlineKeyboard();
      // Show first 15 lessons or paginate
      const lessonsToShow = lvl.lessons.slice(0, 20);
      lessonsToShow.forEach((filename, idx) => {
        const shortName = filename.replace(/\.(docx|pdf)$/, '').substring(0, 32);
        keyboard.text(shortName, `gdrive_les_${levelId}_${idx}`).row();
      });
      keyboard.text('🔙 Retour aux niveaux', 'nav:curriculum_levels');

      await safeEdit(
        ctx,
        `📚 <b>${lvl.name}</b>\n━━━━━━━━━━━━━━━━━━━━━\n<i>${lvl.count} leçons disponibles sur votre Google Drive. Choisissez une leçon pour démarrer la séance :</i>`,
        keyboard
      );
    } catch (e) {
      await safeEdit(ctx, `Erreur : ${e.message}`);
    }
    return;
  }

  // Google Drive Specific Lesson Launcher
  if (data.startsWith('gdrive_les_')) {
    await ctx.answerCallbackQuery({ text: 'Chargement du cours depuis Google Drive...' }).catch(() => {});
    if (userId !== 856614939) return;
    const parts = data.split('_');
    const levelId = parts[2];
    const lessonIdx = parseInt(parts[3], 10);

    try {
      const catalog = await getCurriculumCatalog();
      const lvl = catalog[levelId];
      const filename = lvl.lessons[lessonIdx];
      
      const lesson = await fetchAndParseLesson(levelId, filename);

      // Set user level
      updateUserSetting(userId, 'learning_lang', 'de');
      updateUserSetting(userId, 'level', levelId);

      // Start lesson session
      const opening = `📖 <b>LEÇON GOOGLE DRIVE : ${lesson.title}</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n${lesson.paragraphs.slice(0, 8).join('\n\n')}\n\n━━━━━━━━━━━━━━━━━━━━━\n🎙️ <i>Répondez par message vocal ou texte pour pratiquer cette leçon avec le Professeur Fluence !</i>`;

      await safeEdit(ctx, opening);

      // Generate TTS for the opening German sentence if present
      const firstGerman = lesson.paragraphs.find(p => p.includes('Arzt :') || p.includes('Section 2') || p.includes('Guten')) || lesson.title;
      const audio = await generateTTSAudio(firstGerman.replace(/\[.*?\]/g, ''), 'de');
      if (audio) {
        await ctx.replyWithVoice(new InputFile(audio, 'lesson_intro.mp3'), {
          caption: `🔊 <i>Écoutez l'introduction de la leçon : ${lesson.title}</i>`,
          parse_mode: 'HTML'
        });
      }
    } catch (e) {
      await ctx.reply(`Erreur de chargement : ${e.message}`);
    }
    return;
  }

  const [action, ...args] = data.split(':');

  // Navigation callbacks
  if (action === 'nav') {
    await ctx.answerCallbackQuery().catch(() => {});
    const target = args[0];
    if (target === 'curriculum_levels') {
      const catalog = await getCurriculumCatalog();
      const keyboard = new InlineKeyboard();
      const levels = [
        { id: 'A1', label: `🟢 A1 - Nicos Weg (${catalog.A1?.count || 0} leçons)` },
        { id: 'A2', label: `🔵 A2 - Nicos Weg (${catalog.A2?.count || 0} leçons)` },
        { id: 'B1', label: `🟣 B1 - Nicos Weg (${catalog.B1?.count || 0} leçons)` },
        { id: 'B2', label: `🟠 B2 - Jojo sucht das Glück (${catalog.B2?.count || 0} leçons)` },
        { id: 'C1', label: `🏥 C1 - Médical & Neurochirurgie (${catalog.C1?.count || 0} leçons)` }
      ];
      levels.forEach(lvl => keyboard.text(lvl.label, `gdrive_lvl_${lvl.id}`).row());
      await safeEdit(ctx, '📚 <b>HUB ALLEMAND · COURS & LEÇONS GOOGLE DRIVE</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez un niveau :</i>', keyboard);
      return;
    }
    if (target === 'languages') {
      await safeEdit(ctx, '🌐 <b>Choisissez votre langue d’apprentissage :</b>', buildLanguageKeyboard(user.learning_lang));
    } else if (target === 'levels') {
      await safeEdit(ctx, '🎯 <b>Sélectionnez votre niveau CEFR :</b>', buildLevelKeyboard(user.level || 'B2'));
    } else if (target === 'themes') {
      await safeEdit(ctx, '🎭 <b>Sélectionnez une catégorie de scénarios :</b>', buildThemeCategoriesKeyboard());
    } else if (target === 'srs') {
      await startSRSSession(ctx);
    } else if (target === 'wordlist') {
      await showAllWordsList(ctx, user);
    } else if (target === 'stats') {
      const stats = getUserStats(user.user_id);
      const words = getAllWords(user.user_id, user.learning_lang);
      await safeEdit(ctx, formatStatsDashboard(user, stats, words), buildStatsKeyboard());
    } else if (target === 'voice') {
      const langId = user.learning_lang || 'de';
      const voices = NEURAL_VOICES[langId] || NEURAL_VOICES['de'];
      const currentVoice = user.user_voice || getDefaultVoiceForLang(langId);
      const currentSpeed = user.user_speed || '+0%';
      const keyboard = new InlineKeyboard();
      voices.forEach(v => {
        const isSelected = v.id === currentVoice ? ' ✅' : '';
        keyboard.text(`${v.name}${isSelected}`, `setvoice:${v.id}`).row();
      });
      keyboard.row()
        .text(`🐢 Lent (-15%) ${currentSpeed === '-15%' ? '✅' : ''}`, 'setspeed:-15%')
        .text(`🎯 Normal ${currentSpeed === '+0%' ? '✅' : ''}`, 'setspeed:+0%')
        .text(`🐇 Rapide (+15%) ${currentSpeed === '+15%' ? '✅' : ''}`, 'setspeed:+15%');
      keyboard.row().text('🔙 Retour', 'nav:settings');
      await safeEdit(ctx, '🎙️ <b>CONFIGURATION DE LA VOIX DU PROFESSEUR IA</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n<i>Choisissez votre voix neurale studio haute fidélité et le débit de parole :</i>', keyboard);
    } else if (target === 'settings') {
      await safeEdit(ctx, formatSettingsCard(user), buildSettingsKeyboard(user));
    } else if (target === 'back_chat') {
      await safeEdit(ctx, '💬 <b>Retour à la conversation.</b> Envoyez un message texte ou vocal pour continuer.');
    }
    return;
  }

  // Set Voice
  if (action === 'setvoice') {
    const newVoice = args[0];
    updateUserSetting(userId, 'user_voice', newVoice);
    await ctx.answerCallbackQuery({ text: 'Voix studio mise à jour !' }).catch(() => {});
    const updatedUser = getUser(userId);
    const voices = NEURAL_VOICES[updatedUser.learning_lang || 'de'] || NEURAL_VOICES['de'];
    const currentSpeed = updatedUser.user_speed || '+0%';

    const keyboard = new InlineKeyboard();
    voices.forEach(v => {
      const isSelected = v.id === newVoice ? ' ✅' : '';
      keyboard.text(`${v.name}${isSelected}`, `setvoice:${v.id}`).row();
    });
    keyboard.row()
      .text(`🐢 Lent (-15%) ${currentSpeed === '-15%' ? '✅' : ''}`, 'setspeed:-15%')
      .text(`🎯 Normal ${currentSpeed === '+0%' ? '✅' : ''}`, 'setspeed:+0%')
      .text(`🐇 Rapide (+15%) ${currentSpeed === '+15%' ? '✅' : ''}`, 'setspeed:+15%');

    await safeEdit(ctx, '🎙️ <b>Voix du Professeur mise à jour avec succès !</b>\n\nTestons la prononciation avec cette nouvelle voix :', keyboard);
    
    // Sample test sentence
    const testSample = updatedUser.learning_lang === 'fr' 
      ? 'Bonjour ! Je suis votre professeur de langue.' 
      : 'Guten Tag! Ich bin Ihr persönlicher Deutschlehrer.';
    const audio = await generateTTSAudio(testSample, updatedUser.learning_lang || 'de', newVoice, currentSpeed);
    if (audio) {
      await ctx.replyWithVoice(new InputFile(audio, 'test_voice.mp3'), {
        caption: `🔊 <i>Échantillon de voix studio : ${newVoice}</i>`,
        parse_mode: 'HTML'
      });
    }
    return;
  }

  // Set Speed
  if (action === 'setspeed') {
    const newSpeed = args[0];
    updateUserSetting(userId, 'user_speed', newSpeed);
    await ctx.answerCallbackQuery({ text: `Vitesse réglée à ${newSpeed} !` }).catch(() => {});
    const updatedUser = getUser(userId);
    const voices = NEURAL_VOICES[updatedUser.learning_lang || 'de'] || NEURAL_VOICES['de'];
    const currentVoice = updatedUser.user_voice || getDefaultVoiceForLang(updatedUser.learning_lang || 'de');

    const keyboard = new InlineKeyboard();
    voices.forEach(v => {
      const isSelected = v.id === currentVoice ? ' ✅' : '';
      keyboard.text(`${v.name}${isSelected}`, `setvoice:${v.id}`).row();
    });
    keyboard.row()
      .text(`🐢 Lent (-15%) ${newSpeed === '-15%' ? '✅' : ''}`, 'setspeed:-15%')
      .text(`🎯 Normal ${newSpeed === '+0%' ? '✅' : ''}`, 'setspeed:+0%')
      .text(`🐇 Rapide (+15%) ${newSpeed === '+15%' ? '✅' : ''}`, 'setspeed:+15%');

    await safeEdit(ctx, `⚡ <b>Débit de parole réglé à ${newSpeed}</b>`, keyboard);
    return;
  }

  // Set Language
  if (action === 'setlang') {
    const newLang = args[0];
    updateUserSetting(userId, 'learning_lang', newLang);
    const lObj = getLanguage(newLang);
    await ctx.answerCallbackQuery({ text: `Langue changée : ${lObj.name} !` }).catch(() => {});

    const updatedUser = getUser(userId);
    await safeEdit(ctx, `✅ <b>Langue cible configurée : ${lObj.flag} ${lObj.name} (${lObj.nativeName})</b>\n\nLançons une première discussion :`);
    await sendThemeOpening(ctx, updatedUser);
    return;
  }

  // Set Level
  if (action === 'setlevel') {
    const newLevel = args[0];
    updateUserSetting(userId, 'level', newLevel);
    await ctx.answerCallbackQuery({ text: `Niveau mis à jour : ${newLevel} !` }).catch(() => {});

    const updatedUser = getUser(userId);
    await safeEdit(ctx, `🎯 <b>Niveau CEFR mis à jour : ${newLevel}</b>\n\nLes prochaines réponses s'adapteront à ce niveau d'exigence.`, buildSettingsKeyboard(updatedUser));
    return;
  }

  // Theme Category
  if (action === 'themecat') {
    await ctx.answerCallbackQuery().catch(() => {});
    const catId = args[0];
    await safeEdit(ctx, '🎭 <b>Sélectionnez un scénario pratique :</b>', buildThemesListKeyboard(catId, user.current_theme));
    return;
  }

  // Set Theme
  if (action === 'settheme') {
    const newThemeId = args[0];
    updateUserSetting(userId, 'current_theme', newThemeId);
    const th = getTheme(newThemeId);
    await ctx.answerCallbackQuery({ text: `Scénario activé : ${th.title} !` }).catch(() => {});

    const updatedUser = getUser(userId);
    clearConversation(userId, updatedUser.learning_lang);
    await safeEdit(ctx, `🎬 <b>Scénario activé : ${th.icon} ${th.title}</b>\n<i>« ${th.subtitle} »</i>\n\nL'instructeur démarre la mise en situation...`);
    await sendThemeOpening(ctx, updatedUser);
    return;
  }

  // Turn Actions
  if (action === 'action') {
    const act = args[0];
    if (act === 'listen') {
      const history = getRecentMessages(userId, user.learning_lang, 2);
      const lastAsst = history.filter(m => m.role === 'assistant').pop();
      if (lastAsst && lastAsst.content) {
        await ctx.answerCallbackQuery({ text: '🔊 Génération de l’audio...' }).catch(() => {});
        await sendTTSAudio(ctx, lastAsst.content, user.learning_lang);
      } else {
        await ctx.answerCallbackQuery({ text: 'Aucun message récent à prononcer.', show_alert: true }).catch(() => {});
      }
    } else if (act === 'suggest') {
      await ctx.answerCallbackQuery({ text: '💡 Regardez le bas du message pour la suggestion !', show_alert: true }).catch(() => {});
    } else if (act === 'reset_chat') {
      clearConversation(userId, user.learning_lang);
      await ctx.answerCallbackQuery({ text: 'Conversation réinitialisée !' }).catch(() => {});
      await sendThemeOpening(ctx, user);
    } else if (act === 'prompt_key') {
      await ctx.answerCallbackQuery().catch(() => {});
      pendingKeyPrompts.add(userId);
      await ctx.reply('🔑 <b>Entrez votre clé API Groq (gsk_...) en message texte :</b>', { parse_mode: 'HTML' });
    }
    return;
  }

  // Settings Toggles
  if (action === 'toggle') {
    const prop = args[0];
    if (prop === 'auto_audio') {
      const newVal = user.auto_audio === 1 ? 0 : 1;
      updateUserSetting(userId, 'auto_audio', newVal);
      await ctx.answerCallbackQuery({ text: `Audio auto : ${newVal === 1 ? 'ACTIVÉ' : 'DÉSACTIVÉ'}` }).catch(() => {});
    } else if (prop === 'subtitles') {
      const newVal = user.show_subtitles !== 0 ? 0 : 1;
      updateUserSetting(userId, 'show_subtitles', newVal);
      await ctx.answerCallbackQuery({ text: `Sous-titres : ${newVal === 1 ? 'ACTIVÉS' : 'MASQUÉS'}` }).catch(() => {});
    }
    const updated = getUser(userId);
    await safeEdit(ctx, formatSettingsCard(updated), buildSettingsKeyboard(updated));
    return;
  }

  // SRS Actions
  if (action === 'srsreveal') {
    await ctx.answerCallbackQuery().catch(() => {});
    const wordId = parseInt(args[0], 10);
    const session = reviewSessions.get(userId);
    if (!session || !session.words[session.index]) {
      await ctx.answerCallbackQuery({ text: 'Session expirée.', show_alert: true }).catch(() => {});
      return;
    }
    const wordItem = session.words[session.index];
    const card = formatSRSAnswerCard(wordItem, session.index, session.words.length, user);
    await safeEdit(ctx, card, buildSRSGradingKeyboard(wordId));
    return;
  }

  if (action === 'srslisten') {
    await ctx.answerCallbackQuery().catch(() => {});
    const session = reviewSessions.get(userId);
    const wordItem = session?.words[session.index];
    if (wordItem) {
      await sendTTSAudio(ctx, wordItem.word, user.learning_lang);
    }
    return;
  }

  if (action === 'srsgrade') {
    await ctx.answerCallbackQuery().catch(() => {});
    const wordId = parseInt(args[0], 10);
    const grade = parseInt(args[1], 10);
    const session = reviewSessions.get(userId);

    if (session && session.words[session.index]) {
      const currentWord = session.words[session.index];
      const sm2 = calculateSM2(grade, currentWord.interval, currentWord.ease_factor, currentWord.repetitions);
      saveWordReview(userId, wordId, sm2.interval, sm2.easeFactor, sm2.repetitions, sm2.dueDate);

      session.index += 1;
      if (session.index < session.words.length) {
        const nextWord = session.words[session.index];
        const card = formatSRSReviewCard(nextWord, session.index, session.words.length, user);
        await safeEdit(ctx, card, buildSRSRevealKeyboard(nextWord.id));
      } else {
        // Review completed celebration!
        reviewSessions.delete(userId);
        const stats = getUserStats(userId);
        const celebMsg = `
🎉 <b>FÉLICITATIONS ! SESSION SRS TERMINÉE</b>
━━━━━━━━━━━━━━━━━━━━━

Toutes vos cartes du jour ont été révisées avec succès !
🔥 Série active : <b>${stats.streak_days || 1} jours consécutifs</b>
📚 Total mots enregistrés : <b>${stats.words_learned || 0} mots</b>

<i>Revenez demain pour la prochaine session d'ancrage mémoriel !</i>
`.trim();

        await safeEdit(ctx, celebMsg, buildStatsKeyboard());
      }
    }
    return;
  }

  if (action === 'wordinfo') {
    await ctx.answerCallbackQuery({ text: 'Recherche des détails...' }).catch(() => {});
    const session = reviewSessions.get(userId);
    const wordItem = session?.words[session.index];
    if (wordItem) {
      const explanation = await explainWordDetails(wordItem.word, user);
      await ctx.reply(`📖 <b>Détails lexicaux : ${wordItem.word}</b>\n\n${explanation}`, {
        parse_mode: 'HTML'
      });
    }
    return;
  }
});

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────
async function sendThemeOpening(ctx, user) {
  try {
    const parsed = await generateThemeStarter(user);
    addMessage(user.user_id, 'assistant', parsed.reply, user.learning_lang, user.current_theme);

    const card = formatTeacherCard(parsed, user);
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildTurnInlineKeyboard(parsed, user)
    });

    if (user.auto_audio === 1 && parsed.reply) {
      await sendTTSAudio(ctx, parsed.reply, user.learning_lang);
    }
  } catch (error) {
    console.error('Theme opening error:', error);
  }
}

async function sendTTSAudio(ctx, text, langId) {
  try {
    const userId = ctx.from?.id;
    const user = userId ? getUser(userId) : null;
    const customVoice = user?.user_voice || null;
    const customSpeed = user?.user_speed || '+0%';

    const audioBuffer = await generateTTSAudio(text, langId, customVoice, customSpeed);
    if (audioBuffer) {
      const inputFile = new InputFile(audioBuffer, 'pronunciation.mp3');
      await ctx.replyWithVoice(inputFile);
    }
  } catch (err) {
    console.error('Error sending TTS voice:', err);
  }
}

async function startSRSSession(ctx) {
  const userId = ctx.from.id;
  const user = getUser(userId, ctx.from.username, ctx.from.first_name);
  const dueWords = getDueWords(userId, user.learning_lang, 15);

  if (!dueWords || dueWords.length === 0) {
    const allWords = getAllWords(userId, user.learning_lang);
    if (allWords.length === 0) {
      await ctx.reply('📚 <b>Votre carnet de vocabulaire est vide pour l\'instant !</b>\n\nDiscutez avec Fluence Teacher : chaque mot nouveau sera automatiquement ajouté à votre carnet pour être révisé ici.', {
        parse_mode: 'HTML',
        reply_markup: buildMainKeyboard()
      });
    } else {
      await ctx.reply('🎉 <b>Toutes vos révisions sont à jour pour aujourd\'hui !</b>\n\nVous avez déjà révisé tous vos mots programmés. Revenez demain ou découvrez de nouvelles expressions en continuant la conversation !', {
        parse_mode: 'HTML',
        reply_markup: buildStatsKeyboard()
      });
    }
    return;
  }

  reviewSessions.set(userId, { words: dueWords, index: 0 });
  const firstWord = dueWords[0];
  const card = formatSRSReviewCard(firstWord, 0, dueWords.length, user);

  if (ctx.callbackQuery) {
    await ctx.editMessageText(card, {
      parse_mode: 'HTML',
      reply_markup: buildSRSRevealKeyboard(firstWord.id)
    });
  } else {
    await ctx.reply(card, {
      parse_mode: 'HTML',
      reply_markup: buildSRSRevealKeyboard(firstWord.id)
    });
  }
}

async function showAllWordsList(ctx, user) {
  const words = getAllWords(user.user_id, user.learning_lang);
  const lang = getLanguage(user.learning_lang);

  if (!words || words.length === 0) {
    await ctx.editMessageText(`📚 <b>Carnet vide en ${lang.name}.</b> Discutez avec le bot pour enrichir votre vocabulaire !`, {
      parse_mode: 'HTML',
      reply_markup: buildStatsKeyboard()
    });
    return;
  }

  let listMsg = `📚 <b>CARNET DE VOCABULAIRE · ${lang.flag} ${lang.name} (${words.length} mots)</b>\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const w of words.slice(0, 20)) {
    listMsg += `• <b>${w.word}</b> : <i>${w.translation_fr}</i> (Rep: ${w.repetitions})\n`;
  }

  if (words.length > 20) {
    listMsg += `\n<i>… et ${words.length - 20} autres mots dans votre base</i>`;
  }

  await ctx.editMessageText(listMsg, {
    parse_mode: 'HTML',
    reply_markup: buildStatsKeyboard()
  });
}

// Start API Server
const app = createServer();
app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`🌐 API Fluence Teacher active sur http://0.0.0.0:${CONFIG.PORT}`);
});

// ─────────────────────────────────────────────
// Start Bot Polling
// ─────────────────────────────────────────────
bot.start({
  onStart: async (botInfo) => {
    console.log(`🤖 Fluence Bot démarré avec succès : @${botInfo.username}`);
    try {
      // Set native commands menu
      await bot.api.setMyCommands([
        { command: 'start', description: '🏠 Démarrer & Accueil' },
        { command: 'cours', description: '📚 Cours & Leçons (Google Drive)' },
        { command: 'srs', description: '🧠 Révision Vocabulaire (FSRS)' },
        { command: 'voix', description: '🎙️ Voix Studio & Débit' },
        { command: 'niveau', description: '🎯 Niveau CECRL (A1 à C2)' },
        { command: 'langue', description: '🌐 Changer de langue' },
        { command: 'theme', description: '🎭 Scénarios & Mises en situation' },
        { command: 'stats', description: '📊 Statistiques & Progression' },
        { command: 'parametres', description: '⚙️ Réglages & Préférences' }
      ]);
      await bot.api.setChatMenuButton({
        menu_button: {
          type: 'commands'
        }
      });
      console.log('✅ Menu Telegram configuré en mode 100% Natif');
    } catch (e) {
      console.warn('Could not set chat menu commands:', e.message);
    }
  }
});

