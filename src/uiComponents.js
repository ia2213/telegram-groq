import { InlineKeyboard, Keyboard } from 'grammy';
import { getLanguage, getAllLanguages } from './languages.js';
import { getTheme, THEME_CATEGORIES, getThemesByCategory } from './themes.js';
import { getRecallBars, generateProgressBar, getStreakBadge } from './srsEngine.js';

// Main Reply Keyboard (Ergonomic 3x3)
export function buildMainKeyboard() {
  return new Keyboard()
    .text('💬 Conversation').text('🎙️ Mode Oral (Vocal)').text('📱 Mini App Mural')
    .row()
    .text('🎭 Thèmes & Scénarios').text('📚 Mon Carnet (SRS)').text('📊 Mes Statistiques')
    .row()
    .text('🌐 Changer de Langue').text('🎯 Niveau CEFR').text('⚙️ Paramètres')
    .resized()
    .placeholder('Discutez ou choisissez une action…');
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
    msg += `💡 <b>Point Correction & Grammaire :</b>\n${parsed.correction}\n\n`;
  }

  // Discovered Vocabulary / Chunks
  if (parsed.vocabulary && parsed.vocabulary.length > 0) {
    msg += `📚 <b>Vocabulaire clé (Ajouté au Carnet SRS) :</b>\n`;
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

  kb.text('🎧 Écouter (Audio)', 'action:listen')
    .text('💡 Suggestion', 'action:suggest');

  kb.row()
    .text('📚 Carnet SRS', 'nav:srs')
    .text('🔀 Changer Thème', 'nav:themes');

  kb.row()
    .text(`🎯 Niveau: ${user.level || 'B2'}`, 'nav:levels')
    .text('⚙️ Réglages', 'nav:settings');

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
    kb.text(`${p1}${l1.flag} ${l1.name} (${l1.nativeName})`, `setlang:${l1.id}`);

    if (l2) {
      const p2 = l2.id === currentLangId ? '✅ ' : '';
      kb.text(`${p2}${l2.flag} ${l2.name} (${l2.nativeName})`, `setlang:${l2.id}`);
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
    { id: 'A1', label: '🟢 A1 · Débutant', desc: 'Phrases très simples' },
    { id: 'A2', label: '🟢 A2 · Élémentaire', desc: 'Situations du quotidien' },
    { id: 'B1', label: '🟡 B1 · Intermédiaire', desc: 'Raconter, exprimer des souhaits' },
    { id: 'B2', label: '🟡 B2 · Intermédiaire Sup.', desc: 'Débats & Pro (Recommandé)' },
    { id: 'C1', label: '🟣 C1 · Avancé', desc: 'Nuances et vocabulaire riche' },
    { id: 'C2', label: '🟣 C2 · Bilingue / Maîtrise', desc: 'Aisance totale' }
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

  let msg = `🧠 <b>SESSION DE RÉVISION SRS · CARTE ${queueIndex + 1} / ${queueTotal}</b>\n`;
  msg += `📊 Progression : ${progressBar}\n`;
  msg += `🌐 Langue : <b>${lang.flag} ${lang.name}</b> · Statut : ${recallBar}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📝 <b>Mot / Expression à mémoriser :</b>\n`;
  msg += `👉 <code>${wordItem.word}</code>\n\n`;

  if (wordItem.example_sentence) {
    msg += `📖 <b>Contexte d'utilisation :</b>\n<i>« ${wordItem.example_sentence} »</i>\n\n`;
  }

  msg += `<i>Tentez de vous remémorer le sens en français, puis cliquez pour révéler la réponse.</i>`;
  return msg;
}

export function buildSRSRevealKeyboard(wordId) {
  return new InlineKeyboard()
    .text('👁️ Révéler le sens & Évaluer', `srsreveal:${wordId}`).row()
    .text('🎧 Écouter la prononciation', `srslisten:${wordId}`).row()
    .text('🛑 Quitter la session', 'nav:back_chat');
}

export function formatSRSAnswerCard(wordItem, queueIndex, queueTotal, user) {
  const lang = getLanguage(user.learning_lang);
  const progressBar = generateProgressBar(queueIndex + 1, queueTotal);

  let msg = `🧠 <b>SESSION DE RÉVISION SRS · ${queueIndex + 1} / ${queueTotal}</b>\n`;
  msg += `📊 Progression : ${progressBar}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `📝 <b>Mot :</b> <code>${wordItem.word}</code>\n`;
  msg += `🇫🇷 <b>Sens en français :</b> <b>${wordItem.translation_fr}</b>\n\n`;

  if (wordItem.example_sentence) {
    msg += `📖 <b>Exemple :</b> <i>« ${wordItem.example_sentence} »</i>\n\n`;
  }

  msg += `<b>Comment avez-vous trouvé cette carte ?</b>`;
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
    .text('🔍 Fiche détaillée du mot', `wordinfo:${wordId}`)
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

  msg += `🔥 <b>Série d'assiduité (Streak) :</b>\n`;
  msg += `${streakInfo.badge} <b>${stats.streak_days || 0} jours consécutifs</b> — <i>${streakInfo.title}</i>\n\n`;

  msg += `🌐 <b>Configuration Active :</b>\n`;
  msg += `• Langue cible : <b>${lang.flag} ${lang.name}</b>\n`;
  msg += `• Niveau actuel : <b>${user.level || 'B2'}</b>\n`;
  msg += `• Scénario : <b>${theme.icon} ${theme.title}</b>\n`;
  msg += `• Modèle IA : <code>${user.groq_model || 'llama-3.3-70b-versatile'}</code>\n\n`;

  msg += `📚 <b>Carnet de Vocabulaire (${wordsList.length} mots enregistrés) :</b>\n`;
  msg += `• 🟩 Maîtrisés : <b>${mastered}</b> mots\n`;
  msg += `• 🟨 En apprentissage : <b>${learning}</b> mots\n`;
  msg += `• ⬜ Découverts : <b>${newWords}</b> mots\n`;
  msg += `• 💬 Messages échangés : <b>${stats.messages_count || 0}</b>\n\n`;

  msg += `<i>Pratiquez 5 à 10 minutes chaque jour pour ancrer vos réflexes linguistiques !</i>`;
  return msg;
}

export function buildStatsKeyboard() {
  return new InlineKeyboard()
    .text('🧠 Réviser mes cartes SRS', 'nav:srs')
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

  let msg = `⚙️ <b>PARAMÈTRES & PRÉFÉRENCES · MURAL TEACHER</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  msg += `🌐 <b>Langue cible :</b> ${lang.flag} ${lang.name} (${lang.nativeName})\n`;
  msg += `🎯 <b>Niveau CEFR :</b> ${user.level || 'B2'}\n`;
  msg += `🎙️ <b>Mode Audio Réponse :</b> ${audioMode}\n`;
  msg += `🇫🇷 <b>Sous-titres Français :</b> ${subtitles}\n`;
  msg += `⚡ <b>Modèle IA :</b> <code>${user.groq_model || 'llama-3.3-70b-versatile'}</code>\n`;
  msg += `🔑 <b>Clé API Groq :</b> ${user.groq_api_key ? '✅ Personnalisée' : '⚡ Système standard'}\n\n`;

  msg += `<i>Cliquez ci-dessous pour modifier vos options :</i>`;
  return msg;
}

export function buildSettingsKeyboard(user) {
  const kb = new InlineKeyboard();

  const toggleAudioLabel = user.auto_audio === 1 ? '🔊 Audio Auto : ON' : '🔇 Audio Auto : OFF';
  const toggleSubLabel = user.show_subtitles !== 0 ? '🇫🇷 Sous-titres : ON' : '🇫🇷 Sous-titres : OFF';

  kb.text(toggleAudioLabel, 'toggle:auto_audio')
    .text(toggleSubLabel, 'toggle:subtitles');

  kb.row()
    .text('🌐 Changer de Langue', 'nav:languages')
    .text('🎯 Changer de Niveau', 'nav:levels');

  kb.row()
    .text('🔑 Configurer Clé Groq', 'action:prompt_key')
    .text('⚡ Changer de Modèle', 'nav:models');

  kb.row()
    .text('🔙 Retour à la conversation', 'nav:back_chat');

  return kb;
}
