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
import { generateTTSAudio } from './ttsService.js';
import { transcribeAudioWithWhisper } from './groqClient.js';
import { calculateSM2 } from './srsEngine.js';
import {
  buildMainKeyboard, formatTeacherCard, buildTurnInlineKeyboard,
  buildLanguageKeyboard, buildLevelKeyboard, buildThemeCategoriesKeyboard,
  buildThemesListKeyboard, formatSRSReviewCard, buildSRSRevealKeyboard,
  formatSRSAnswerCard, buildSRSGradingKeyboard, formatStatsDashboard,
  buildStatsKeyboard, formatSettingsCard, buildSettingsKeyboard
} from './uiComponents.js';

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

bot.command(['app', 'miniapp'], async (ctx) => {
  const webAppUrl = CONFIG.WEBAPP_URL || `http://localhost:${CONFIG.PORT}`;
  const kb = new InlineKeyboard().webApp('📱 Ouvrir la Mini App Mural', webAppUrl);
  await ctx.reply(`🚀 <b>MURAL TEACHER · MINI APP</b>\n\nLancez la Mini App pour profiter de l'expérience visuelle complète :\n• 🎙️ <b>Orbe vivant interactif</b> (Pulsation sonore & pratique vocale)\n• 🎭 <b>24 Scénarios immersifs</b> en 1 clic\n• 📚 <b>Flashcards SRS (SuperMemo-2)</b> avec cartes 3D\n• 📊 <b>Tableau de bord de progression</b> & Streaks`, {
    parse_mode: 'HTML',
    reply_markup: kb
  });
});

// ─────────────────────────────────────────────
// Command: /start
// ─────────────────────────────────────────────
bot.command('start', async (ctx) => {
  const user = getUser(ctx.from.id, ctx.from.username, ctx.from.first_name);
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);

  const welcomeText = `
╭─────────────────────────────────╮
│  ✨ <b>MURAL TEACHER · AI TUTOR</b>  │
╰─────────────────────────────────╯
Bonjour <b>${ctx.from.first_name}</b> ! 🌟

Je suis <b>Mural Teacher</b>, votre professeur particulier et partenaire de conversation immersif propulsé par l'IA.

🎯 <b>Vos réglages actuels :</b>
• Langue étudiée : <b>${lang.flag} ${lang.name} (${lang.nativeName})</b>
• Niveau visé : <b>${user.level || 'B2'}</b>
• Scénario actif : <b>${theme.icon} ${theme.title}</b>

💡 <b>Comment pratiquer :</b>
1. <b>Discutez librement</b> par écrit ou envoyez des <b>notes vocales</b> 🎙️
2. Je m'exprime en <b>${lang.name}</b>, vous corrige avec bienveillance et ajoute automatiquement les nouveaux mots à votre <b>Carnet SRS</b> 📚.
3. Cliquez sur <code>🎧 Écouter</code> pour travailler votre compréhension orale et votre prononciation.
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
bot.command('help', async (ctx) => {
  const helpText = `
📖 <b>GUIDE D'UTILISATION · MURAL TEACHER</b>
━━━━━━━━━━━━━━━━━━━━━

<b>Commandes principales :</b>
• <code>/start</code> : Réinitialise et relance l'accueil
• <code>/lang</code> : Changer la langue d'apprentissage (12 langues disponibles)
• <code>/level</code> : Définir votre niveau CEFR (A1 à C2)
• <code>/theme</code> : Choisir parmi 24 situations & jeux de rôle
• <code>/srs</code> ou <code>/review</code> : Lancer votre révision de vocabulaire
• <code>/stats</code> : Consulter vos statistiques & votre streak
• <code>/settings</code> : Modifier vos préférences (Sous-titres, Audio auto)
• <code>/reset</code> : Effacer l'historique et repartir à zéro
• <code>/setkey &lt;clé&gt;</code> : Configurer votre clé personnelle Groq

🎙️ <b>Pratique Vocale :</b>
Envoyez simplement une <b>note vocale Telegram</b> en parlant dans la langue cible ! L'IA écoute, retranscrit et vous répond oralement.
`.trim();

  await ctx.reply(helpText, { parse_mode: 'HTML', reply_markup: buildMainKeyboard() });
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
  await ctx.reply('🎯 <b>Sélectionnez votre niveau de maîtrise visé (CEFR) :</b>\n\n<i>Mural adaptera la complexité des phrases, le vocabulaire et le débit de parole.</i>', {
    parse_mode: 'HTML',
    reply_markup: buildLevelKeyboard(user.level || 'B2')
  });
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
  if (text === '💬 Conversation') {
    const user = getUser(userId, ctx.from.username, ctx.from.first_name);
    await ctx.reply(`💬 <b>Conversation active en ${getLanguage(user.learning_lang).name}</b>. Que souhaitez-vous me dire ?`, { parse_mode: 'HTML' });
    return;
  }
  if (text === '🎙️ Mode Oral (Vocal)') {
    const user = getUser(userId);
    const lang = getLanguage(user.learning_lang);
    await ctx.reply(`🎙️ <b>Mode Pratique Orale (${lang.flag} ${lang.name})</b>\n\nMaintenez le bouton micro 🎙️ de Telegram et enregistrez votre réponse en <b>${lang.name}</b> !\n\nJe vais analyser votre prononciation et vous répondre en audio.`, { parse_mode: 'HTML' });
    return;
  }
  if (text === '📱 Mini App Mural') {
    const webAppUrl = CONFIG.WEBAPP_URL || `http://localhost:${CONFIG.PORT}`;
    const kb = new InlineKeyboard().webApp('📱 Ouvrir la Mini App Mural', webAppUrl);
    await ctx.reply(`🚀 <b>MURAL TEACHER · MINI APP</b>\n\nLancez l'interface vocale interactive, l'orbe animé et vos révisions SRS !`, {
      parse_mode: 'HTML',
      reply_markup: kb
    });
    return;
  }
  if (text === '🎭 Thèmes & Scénarios') {
    await ctx.reply('🎭 <b>Sélectionnez une catégorie de scénarios :</b>', {
      parse_mode: 'HTML',
      reply_markup: buildThemeCategoriesKeyboard()
    });
    return;
  }
  if (text === '📚 Mon Carnet (SRS)') {
    await startSRSSession(ctx);
    return;
  }
  if (text === '🌐 Changer de Langue') {
    const user = getUser(userId);
    await ctx.reply('🌐 <b>Choisissez votre langue d’apprentissage :</b>', {
      parse_mode: 'HTML',
      reply_markup: buildLanguageKeyboard(user.learning_lang)
    });
    return;
  }
  if (text === '📊 Mes Statistiques') {
    const user = getUser(userId, ctx.from.username, ctx.from.first_name);
    const stats = getUserStats(user.user_id);
    const words = getAllWords(user.user_id, user.learning_lang);
    await ctx.reply(formatStatsDashboard(user, stats, words), {
      parse_mode: 'HTML',
      reply_markup: buildStatsKeyboard()
    });
    return;
  }
  if (text === '🎯 Niveau CEFR') {
    const user = getUser(userId);
    await ctx.reply('🎯 <b>Sélectionnez votre niveau CEFR :</b>', {
      parse_mode: 'HTML',
      reply_markup: buildLevelKeyboard(user.level || 'B2')
    });
    return;
  }
  if (text === '💡 Astuce du Jour') {
    const user = getUser(userId);
    const lang = getLanguage(user.learning_lang);
    const tipMsg = `💡 <b>Astuce linguistique (${lang.flag} ${lang.name}) :</b>\n\n` +
      `Pour progresser rapidement vers le niveau <b>${user.level || 'B2'}</b>, essayez de remplacer les mots basiques par des tournures idiomatiques et des connecteurs logiques.\n` +
      `<i>Exemple : En allemand, utilisez la structure « Je ... desto ... » (plus ... plus ...) pour formuler des corrélations élégantes !</i>`;
    await ctx.reply(tipMsg, { parse_mode: 'HTML' });
    return;
  }
  if (text === '⚙️ Paramètres') {
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

  const [action, ...args] = data.split(':');

  // Navigation callbacks
  if (action === 'nav') {
    await ctx.answerCallbackQuery().catch(() => {});
    const target = args[0];
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
    } else if (target === 'settings') {
      await safeEdit(ctx, formatSettingsCard(user), buildSettingsKeyboard(user));
    } else if (target === 'back_chat') {
      await safeEdit(ctx, '💬 <b>Retour à la conversation.</b> Envoyez un message texte ou vocal pour continuer.');
    }
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
    const audioBuffer = await generateTTSAudio(text, langId);
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
      await ctx.reply('📚 <b>Votre carnet de vocabulaire est vide pour l\'instant !</b>\n\nDiscutez avec Mural Teacher : chaque mot nouveau sera automatiquement ajouté à votre carnet pour être révisé ici.', {
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

// Start Mini App Server
const app = createServer();
app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`🌐 Mini App Mural Teacher active sur http://0.0.0.0:${CONFIG.PORT}`);
});

// ─────────────────────────────────────────────
// Start Bot Polling
// ─────────────────────────────────────────────
bot.start({
  onStart: (botInfo) => {
    console.log(`🤖 Mural Teacher Bot démarré avec succès : @${botInfo.username}`);
  }
});

