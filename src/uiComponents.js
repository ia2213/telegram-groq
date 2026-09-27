import { InlineKeyboard, Keyboard } from 'grammy';
import { getLanguage, getAllLanguages } from './languages.js';
import { getTheme, THEME_CATEGORIES, getThemesByCategory } from './themes.js';
import { getRecallBars, generateProgressBar, getStreakBadge } from './srsEngine.js';
import { NEURAL_VOICES, getDefaultVoiceForLang } from './ttsService.js';

// Ergonomic Persistent Reply Keyboard (2x3 Layout - 100% Native Telegram)
export function buildMainKeyboard() {
  return new Keyboard()
    .text('🎙️ Parler avec le Professeur').text('📚 Mes Cours & Leçons')
    .row()
    .text('🧠 Répétition FSRS (Vocab)').text('🎯 Mon Niveau & Langue')
    .row()
    .text('🔊 Voix Studio & Débit').text('⚙️ Paramètres & Stats')
    .resized()
    .placeholder('Parlez par message vocal ou texte…');
}

// Conversation Turn Response Card
export function formatTeacherCard(parsed, user, options = {}) {
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);
  const level = user.level || 'B2';

  let msg = `<b>${lang.flag} ${lang.name.toUpperCase()} · ${level} · ${theme.icon} ${theme.title}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Main Target Language Reply
  msg += `${parsed.reply}\n\n`;

  // French Subtitles / Translation in expandable blockquote
  if (parsed.translationFr && user.show_subtitles !== 0) {
    msg += `<blockquote expandable>🇫🇷 <b>Traduction :</b>\n<i>${parsed.translationFr}</i></blockquote>\n\n`;
  }

  // Gentle Correction / Grammar Recast if available
  if (parsed.correction) {
    msg += `💡 <b>Correction & Règle :</b>\n${parsed.correction}\n\n`;
  }

  // Discovered Vocabulary / Chunks
  if (parsed.vocabulary && parsed.vocabulary.length > 0) {
    msg += `📚 <b>Vocabulaire clé (Ajouté au FSRS) :</b>\n`;
    for (const v of parsed.vocabulary) {
      msg += `• <b>${v.word}</b> : <i>${v.translation}</i>\n`;
    }
    msg += `\n`;
  }

  // Suggested Reply Hint if available
  if (parsed.suggestedReply) {
    msg += `💬 <b>Suggestion pour répondre :</b>\n<code>${parsed.suggestedReply}</code>\n`;
  }

  return msg.trim();
}

// Action Toolbar Inline Keyboard for each conversation turn
export function buildTurnInlineKeyboard(parsed, user) {
  const kb = new InlineKeyboard();

  kb.text('🔄 Réécouter l\'audio', 'action:listen')
    .text('💡 Suggestion', 'action:suggest');

  kb.row()
    .text('🧠 Carnet FSRS', 'nav:srs')
    .text('🔀 Scénario', 'nav:themes');

  kb.row()
    .text(`🎯 Niveau : ${user.level || 'B2'}`, 'nav:levels')
    .text('🎙️ Voix Studio', 'nav:voice');

  return kb;
}

// Language Picker Keyboard
export function buildLanguageKeyboard(currentLangId) {
  const kb = new InlineKeyboard();
  const languages = getAllLanguages();

  for (let i = 0; i < languages.length; i += 2) {
    const l1 = languages[i];
    const l2 = languages[i + 1];

    const p1 = l1.id === currentLangId ? '✅ ' : '';
    kb.text(`${p1}${l1.flag} ${l1.name}`, `setlang:${l1.id}`);

    if (l2) {
      const p2 = l2.id === currentLangId ? '✅ ' : '';
      kb.text(`${p2}${l2.flag} ${l2.name}`, `setlang:${l2.id}`);
    }
    kb.row();
  }

  kb.text('🔙 Retour à la conversation', 'nav:back_chat');
  return kb;
}

// CEFR Level Picker Keyboard
export function buildLevelKeyboard(currentLevel = 'B2') {
  const kb = new InlineKeyboard();
  const levels = [
    { id: 'A1', label: '🟢 A1 · Débutant' },
    { id: 'A2', label: '🟢 A2 · Élémentaire' },
    { id: 'B1', label: '🟡 B1 · Intermédiaire' },
    { id: 'B2', label: '🟡 B2 · Intermédiaire Sup.' },
    { id: 'C1', label: '🟣 C1 · Médical & Avancé' },
    { id: 'C2', label: '🟣 C2 · Maîtrise Totale' }
  ];

  for (let i = 0; i < levels.length; i += 2) {
    const l1 = levels[i];
    const l2 = levels[i + 1];

    const p1 = l1.id === currentLevel ? '✅ ' : '';
    kb.text(`${p1}${l1.label}`, `setlevel:${l1.id}`);

    if (l2) {
      const p2 = l2.id === currentLevel ? '✅ ' : '';
      kb.text(`${p2}${l2.label}`, `setlevel:${l2.id}`);
    }
    kb.row();
  }

  kb.text('🔙 Retour à la conversation', 'nav:back_chat');
  return kb;
}

// Theme Categories & Scenarios Keyboard
export function buildThemeCategoriesKeyboard() {
  const kb = new InlineKeyboard();

  for (const cat of THEME_CATEGORIES) {
    kb.text(`${cat.icon} ${cat.name}`, `themecat:${cat.id}`).row();
  }

  kb.text('💭 Conversation Libre (Improvisée)', 'settheme:free_talk').row();
  kb.text('🔙 Retour', 'nav:back_chat');
  return kb;
}

export function buildThemesListKeyboard(categoryId, currentThemeId) {
  const kb = new InlineKeyboard();
  const themes = getThemesByCategory(categoryId);

  for (const t of themes) {
    const prefix = t.id === currentThemeId ? '✅ ' : '';
    kb.text(`${prefix}${t.icon} ${t.title}`, `settheme:${t.id}`).row();
  }

  kb.text('🔙 Choisir une autre catégorie', 'nav:themes').row();
  kb.text('🏠 Retour à la conversation', 'nav:back_chat');
  return kb;
}

// Spaced Repetition (SRS) Review Card
export function formatSRSReviewCard(wordItem, queueIndex, queueTotal, user) {
  const lang = getLanguage(user.learning_lang);
  const progressBar = generateProgressBar(queueIndex + 1, queueTotal);
  const recallBar = getRecallBars(wordItem.repetitions);

  let msg = `🧠 <b>RÉPÉTITION ESPACÉE FSRS · CARTE ${queueIndex + 1} / ${queueTotal}</b>\n`;
  msg += `📊 Progression : ${progressBar}\n`;
  msg += `🌐 Langue : <b>${lang.flag} ${lang.name}</b> · Mémorisation : ${recallBar}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📝 <b>Mot / Expression à mémoriser :</b>\n`;
  msg += `👉 <code>${wordItem.word}</code>\n\n`;

  if (wordItem.example_sentence) {
    msg += `📖 <b>Exemple de contexte :</b>\n<i>« ${wordItem.example_sentence} »</i>\n\n`;
  }

  msg += `<i>Tentez de retrouver le sens en français, puis cliquez pour vérifier.</i>`;
  return msg;
}

export function buildSRSRevealKeyboard(wordId) {
  return new InlineKeyboard()
    .text('👁️ Révéler la réponse & Évaluer', `srsreveal:${wordId}`).row()
    .text('🎧 Écouter la prononciation', `srslisten:${wordId}`).row()
    .text('🛑 Quitter la session', 'nav:back_chat');
}

export function formatSRSAnswerCard(wordItem, queueIndex, queueTotal, user) {
  const lang = getLanguage(user.learning_lang);
  const progressBar = generateProgressBar(queueIndex + 1, queueTotal);

  let msg = `🧠 <b>RÉPÉTITION ESPACÉE FSRS · ${queueIndex + 1} / ${queueTotal}</b>\n`;
  msg += `📊 Progression : ${progressBar}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📝 <b>Mot :</b> <code>${wordItem.word}</code>\n`;
  msg += `🇫🇷 <b>Sens en français :</b> <b>${wordItem.translation_fr}</b>\n\n`;

  if (wordItem.example_sentence) {
    msg += `📖 <b>Exemple :</b> <i>« ${wordItem.example_sentence} »</i>\n\n`;
  }

  msg += `<b>Indiquez votre niveau de facilité :</b>`;
  return msg;
}

export function buildSRSGradingKeyboard(wordId) {
  return new InlineKeyboard()
    .text('🔴 À revoir (1j)', `srsgrade:${wordId}:1`)
    .text('🟧 Difficile (2j)', `srsgrade:${wordId}:2`)
    .row()
    .text('🟦 Bon (4j)', `srsgrade:${wordId}:3`)
    .text('🟩 Facile (10j)', `srsgrade:${wordId}:4`)
    .row()
    .text('🔍 Fiche détaillée', `wordinfo:${wordId}`)
    .row()
    .text('🛑 Terminer la session', 'nav:back_chat');
}

// User Dashboard & Statistics Card
export function formatStatsDashboard(user, stats, wordsList) {
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);
  const streakInfo = getStreakBadge(stats.streak_days || 0);

  const mastered = wordsList.filter(w => w.repetitions >= 4).length;
  const learning = wordsList.filter(w => w.repetitions > 0 && w.repetitions < 4).length;
  const newWords = wordsList.filter(w => w.repetitions === 0).length;

  let msg = `📊 <b>TABLEAU DE BORD · ${user.first_name || 'Apprenant'}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🔥 <b>Série d'assiduité :</b>\n`;
  msg += `${streakInfo.badge} <b>${stats.streak_days || 0} jours consécutifs</b> — <i>${streakInfo.title}</i>\n\n`;

  msg += `🌐 <b>Configuration Active :</b>\n`;
  msg += `• Langue cible : <b>${lang.flag} ${lang.name}</b>\n`;
  msg += `• Niveau actuel : <b>${user.level || 'B2'}</b>\n`;
  msg += `• Scénario actif : <b>${theme.icon} ${theme.title}</b>\n\n`;

  msg += `📚 <b>Carnet de Vocabulaire FSRS (${wordsList.length} mots) :</b>\n`;
  msg += `• 🟩 Mémorisés : <b>${mastered}</b> mots\n`;
  msg += `• 🟨 En cours d'ancrage : <b>${learning}</b> mots\n`;
  msg += `• ⬜ Nouveaux : <b>${newWords}</b> mots\n`;
  msg += `• 💬 Messages échangés : <b>${stats.messages_count || 0}</b>\n`;

  return msg;
}

export function buildStatsKeyboard() {
  return new InlineKeyboard()
    .text('🧠 Réviser le vocabulaire FSRS', 'nav:srs')
    .text('📋 Voir tout le carnet', 'nav:wordlist')
    .row()
    .text('🔄 Réinitialiser la discussion', 'action:reset_chat')
    .text('⚙️ Paramètres', 'nav:settings')
    .row()
    .text('🔙 Retour à la conversation', 'nav:back_chat');
}

// Settings Menu Card & Keyboard
export function formatSettingsCard(user) {
  const lang = getLanguage(user.learning_lang);
  const audioMode = user.auto_audio === 1 ? '🔊 Activé (Vocal automatique)' : '🔇 Texte (Audio sur demande)';
  const subtitles = user.show_subtitles !== 0 ? '👁️ Affichés' : '🙈 Masqués';
  const voice = user.user_voice || getDefaultVoiceForLang(user.learning_lang || 'de');
  const speed = user.user_speed || '+0%';

  let msg = `⚙️ <b>PARAMÈTRES & PRÉFÉRENCES · FLUENCE</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🌐 <b>Langue cible :</b> ${lang.flag} ${lang.name} (${lang.nativeName})\n`;
  msg += `🎯 <b>Niveau CEFR :</b> ${user.level || 'B2'}\n`;
  msg += `🎙️ <b>Voix Studio :</b> <code>${voice}</code>\n`;
  msg += `⚡ <b>Débit vocal :</b> <code>${speed}</code>\n`;
  msg += `🔊 <b>Réponse Vocale :</b> ${audioMode}\n`;
  msg += `🇫🇷 <b>Sous-titres Traduits :</b> ${subtitles}\n\n`;

  msg += `<i>Touchez une option ci-dessous pour la modifier :</i>`;
  return msg;
}

export function buildSettingsKeyboard(user) {
  const kb = new InlineKeyboard();

  const toggleAudioLabel = user.auto_audio === 1 ? '🔊 Audio Auto : ON' : '🔇 Audio Auto : OFF';
  const toggleSubLabel = user.show_subtitles !== 0 ? '🇫🇷 Traduction : ON' : '🇫🇷 Traduction : OFF';

  kb.text(toggleAudioLabel, 'toggle:auto_audio')
    .text(toggleSubLabel, 'toggle:subtitles');

  kb.row()
    .text('🌐 Changer de Langue', 'nav:languages')
    .text('🎯 Changer de Niveau', 'nav:levels');

  kb.row()
    .text('🎙️ Choisir la Voix Studio', 'nav:voice')
    .text('📊 Mes Statistiques', 'nav:stats');

  kb.row()
    .text('🔙 Retour à la conversation', 'nav:back_chat');

  return kb;
}
