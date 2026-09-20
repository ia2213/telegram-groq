/**
 * Mural Teacher · Telegram Mini App Frontend
 * Powered by Telegram WebApp SDK + UI/UX Pro Max
 */

// Initialize Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  if (tg.setHeaderColor) tg.setHeaderColor('#090d16');
  if (tg.setBackgroundColor) tg.setBackgroundColor('#090d16');
}

// Global State
let currentUser = {
  user_id: tg?.initDataUnsafe?.user?.id || 856614939,
  first_name: tg?.initDataUnsafe?.user?.first_name || 'Ami',
  learning_lang: 'de',
  level: 'B2',
  current_theme: 'free_talk',
  auto_audio: 0,
  show_subtitles: 1
};

let languagesList = [];
let themesList = [];
let dueWordsList = [];
let currentSrsIndex = 0;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let isAudioPlaying = false;
let currentAudioElement = null;

// Trigger haptic feedback
function haptic(type = 'light') {
  try {
    if (tg?.HapticFeedback) {
      if (type === 'light') tg.HapticFeedback.impactOccurred('light');
      if (type === 'medium') tg.HapticFeedback.impactOccurred('medium');
      if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      if (type === 'warning') tg.HapticFeedback.notificationOccurred('warning');
    }
  } catch (e) {}
}

// Lifecycle: DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  await loadUserData();
  await loadLanguages();
  await loadThemes();
  await loadSrsDueWords();
  renderInitialMessage();

  // Enter key in chat input
  document.getElementById('chatInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendTextMessage();
    }
  });
});

// Load User Data
async function loadUserData() {
  try {
    const res = await fetch(`/api/user?user_id=${currentUser.user_id}`);
    if (res.ok) {
      const data = await res.json();
      currentUser = { ...currentUser, ...data.user };
      updateHeaderUI();
      updateStatsUI(data.stats);
    }
  } catch (err) {
    console.error('Failed to load user:', err);
  }
}

// Update Header UI
function updateHeaderUI() {
  const flags = { de: '🇩🇪', es: '🇪🇸', en: '🇬🇧', fr: '🇫🇷', it: '🇮🇹', pt: '🇧🇷', nb: '🇳🇴', zh: '🇨🇳', ro: '🇷🇴', ar: '🇸🇦', ru: '🇷🇺', ja: '🇯🇵' };
  const flag = flags[currentUser.learning_lang] || '🇩🇪';
  
  const flagEl = document.getElementById('headerLangFlag');
  if (flagEl) flagEl.textContent = flag;

  const badgeEl = document.getElementById('headerLevelBadge');
  if (badgeEl) badgeEl.textContent = currentUser.level || 'B2';

  const themeObj = themesList.find(t => t.id === currentUser.current_theme);
  const scenarioEl = document.getElementById('headerScenario');
  if (scenarioEl) scenarioEl.textContent = themeObj ? `${themeObj.icon} ${themeObj.name}` : '☕ Conversation Libre';

  const streakEl = document.getElementById('headerStreak');
  if (streakEl) streakEl.textContent = `${currentUser.streak_days || 1} j`;
}

// Tab Switcher
function switchTab(tabId) {
  haptic('light');
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach(el => {
    el.classList.remove('text-sky-400');
    el.classList.add('text-slate-400');
  });

  const activeTab = document.getElementById(`tab-${tabId}`);
  if (activeTab) activeTab.classList.remove('hidden');

  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.remove('text-slate-400');
    activeNav.classList.add('text-sky-400');
  }

  if (tabId === 'srs') {
    loadSrsDueWords();
  }
}

// Living Mural Orb Control
function setOrbState(state) {
  const orb = document.getElementById('muralOrb');
  const wave1 = document.getElementById('orbWave1');
  const wave2 = document.getElementById('orbWave2');
  const status = document.getElementById('orbStatus');
  const subStatus = document.getElementById('orbSubStatus');
  const icon = document.getElementById('orbIcon');

  if (state === 'listening') {
    orb?.classList.add('scale-110');
    wave1?.classList.add('wave-active-1');
    wave2?.classList.add('wave-active-2');
    if (status) status.textContent = "Je vous écoute...";
    if (subStatus) subStatus.textContent = "Parlez maintenant (relâchez pour envoyer)";
    if (icon) icon.textContent = "🎙️";
  } else if (state === 'thinking') {
    orb?.classList.remove('scale-110');
    wave1?.classList.remove('wave-active-1');
    wave2?.classList.remove('wave-active-2');
    if (status) status.textContent = "Réflexion en cours...";
    if (subStatus) subStatus.textContent = "Préparation de la réponse et du vocabulaire";
    if (icon) icon.textContent = "✨";
  } else if (state === 'speaking') {
    orb?.classList.add('scale-105');
    wave1?.classList.add('wave-active-1');
    if (status) status.textContent = "Le tuteur parle...";
    if (subStatus) subStatus.textContent = "Écoutez la prononciation";
    if (icon) icon.textContent = "🔊";
  } else {
    // Idle
    orb?.classList.remove('scale-110', 'scale-105');
    wave1?.classList.remove('wave-active-1');
    wave2?.classList.remove('wave-active-2');
    if (status) status.textContent = "Touchez l'orbe pour parler";
    if (subStatus) subStatus.textContent = "ou écrivez ci-dessous";
    if (icon) icon.textContent = "🎙️";
  }
}

// Trigger Voice from Orb
function triggerOrbVoice() {
  toggleVoiceRecord();
}

// Toggle Voice Recording (MediaRecorder)
async function toggleVoiceRecord() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await handleVoiceSubmission(audioBlob);
      };

      mediaRecorder.start();
      isRecording = true;
      haptic('medium');
      setOrbState('listening');
      document.getElementById('micBtn')?.classList.add('animate-pulse', 'ring-2', 'ring-sky-400');
    } catch (err) {
      console.warn('Microphone access not available or denied:', err);
      alert('Veuillez autoriser l\'accès au microphone pour l\'enregistrement vocal.');
    }
  } else {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    isRecording = false;
    haptic('light');
    setOrbState('thinking');
    document.getElementById('micBtn')?.classList.remove('animate-pulse', 'ring-2', 'ring-sky-400');
  }
}

// Handle Voice Submission
async function handleVoiceSubmission(audioBlob) {
  try {
    setOrbState('thinking');
    const formData = new FormData();
    formData.append('audio', audioBlob, 'voice.webm');
    formData.append('user_id', currentUser.user_id);
    formData.append('language', currentUser.learning_lang);

    // Call transcription endpoint
    const res = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      const transcribedText = data.text || "Hallo!";
      appendUserMessage(transcribedText, true);
      await processConversationTurn(transcribedText);
    } else {
      setOrbState('idle');
    }
  } catch (err) {
    console.error('Voice submission error:', err);
    setOrbState('idle');
  }
}

// Send Text Message
async function sendTextMessage() {
  const input = document.getElementById('chatInput');
  const text = input?.value?.trim();
  if (!text) return;

  input.value = '';
  haptic('light');
  appendUserMessage(text, false);
  await processConversationTurn(text);
}

// Process Turn with AI Engine
async function processConversationTurn(userMessage) {
  setOrbState('thinking');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        message: userMessage,
        language: currentUser.learning_lang,
        level: currentUser.level,
        theme: currentUser.current_theme
      })
    });

    if (res.ok) {
      const data = await res.json();
      appendTeacherMessage(data);

      if (data.suggestedReply) {
        showSuggestion(data.suggestedReply);
      }

      // Auto play audio if enabled
      if (currentUser.auto_audio) {
        playTTS(data.reply, currentUser.learning_lang);
      } else {
        setOrbState('idle');
      }
    } else {
      setOrbState('idle');
    }
  } catch (err) {
    console.error('Chat error:', err);
    setOrbState('idle');
  }
}

// Append User Bubble
function appendUserMessage(text, isVoice = false) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const div = document.createElement('div');
  div.className = 'flex justify-end animate-fade-in';
  div.innerHTML = `
    <div class="chat-bubble-user max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 shadow-lg text-white text-xs sm:text-sm">
      <div class="flex items-center gap-1.5 mb-1 opacity-80 text-[10px]">
        <span>${isVoice ? '🎙️ Message vocal' : '👤 Vous'}</span>
      </div>
      <p class="leading-relaxed font-normal">${escapeHtml(text)}</p>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Append Teacher Card
function appendTeacherMessage(data) {
  const container = document.getElementById('messagesContainer');
  if (!container) return;

  const flags = { de: '🇩🇪', es: '🇪🇸', en: '🇬🇧', fr: '🇫🇷', it: '🇮🇹', pt: '🇧🇷', nb: '🇳🇴', zh: '🇨🇳', ro: '🇷🇴', ar: '🇸🇦', ru: '🇷🇺', ja: '🇯🇵' };
  const flag = flags[currentUser.learning_lang] || '🇩🇪';

  const div = document.createElement('div');
  div.className = 'flex justify-start animate-fade-in';

  let vocabHtml = '';
  if (data.vocabulary && data.vocabulary.length > 0) {
    vocabHtml = `
      <div class="mt-2.5 pt-2 border-t border-white/[0.08]">
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">📚 Vocabulaire Clé :</p>
        <div class="space-y-1">
          ${data.vocabulary.map(v => `
            <div class="flex items-baseline justify-between text-xs bg-slate-900/60 px-2 py-1 rounded-lg border border-white/[0.04]">
              <span class="font-bold text-sky-300">${escapeHtml(v.word)}</span>
              <span class="text-slate-300 italic text-[11px]">${escapeHtml(v.translation)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  let correctionHtml = '';
  if (data.correction && data.correction !== 'NONE' && data.correction.trim() !== '') {
    correctionHtml = `
      <div class="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
        <span class="font-bold">💡 Recast / Correction :</span>
        <p class="text-[11px] mt-0.5 text-amber-100">${escapeHtml(data.correction)}</p>
      </div>
    `;
  }

  let translationHtml = '';
  if (data.translationFr && currentUser.show_subtitles) {
    translationHtml = `
      <details class="mt-2.5 group">
        <summary class="text-[11px] font-semibold text-sky-400 cursor-pointer hover:text-sky-300 flex items-center gap-1">
          <span>🇫🇷 Traduction en français</span>
          <span class="text-[9px] transition-transform group-open:rotate-180">▼</span>
        </summary>
        <p class="text-xs text-slate-300 italic mt-1.5 p-2 rounded-lg bg-slate-900/50 border border-white/[0.04]">
          ${escapeHtml(data.translationFr)}
        </p>
      </details>
    `;
  }

  div.innerHTML = `
    <div class="chat-bubble-teacher max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 shadow-xl text-white text-xs sm:text-sm bg-slate-800/80 border border-white/[0.08]">
      
      <!-- Card Header -->
      <div class="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.06] text-[11px]">
        <div class="flex items-center gap-1.5 font-bold text-sky-400">
          <span>${flag}</span>
          <span>Tuteur · ${currentUser.level}</span>
        </div>
        <button onclick="playTTS('${escapeQuote(data.reply)}', '${currentUser.learning_lang}')" class="px-2 py-0.5 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 text-[10px] font-semibold transition">
          <span>🔊</span>
          <span>Écouter</span>
        </button>
      </div>

      <!-- Main Target Language Dialogue -->
      <p class="leading-relaxed font-medium text-slate-100">${escapeHtml(data.reply)}</p>

      ${translationHtml}
      ${correctionHtml}
      ${vocabHtml}
    </div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Initial Greeting Card
function renderInitialMessage() {
  const container = document.getElementById('messagesContainer');
  if (!container || container.children.length > 0) return;

  const data = {
    reply: "Hallo! Ich bin dein Mural-Sprachlehrer. Wie kann ich dir heute beim Deutschlernen helfen?",
    translationFr: "Bonjour ! Je suis ton tuteur de langue Mural. Comment puis-je t'aider aujourd'hui dans ton apprentissage de l'allemand ?",
    suggestedReply: "Ich möchte mein Deutsch für das B2-Niveau verbessern.",
    vocabulary: [
      { word: "der Sprachlehrer", translation: "le tuteur / professeur de langue", example: "" }
    ]
  };

  appendTeacherMessage(data);
  showSuggestion(data.suggestedReply);
}

// Play Speech Audio via TTS API
async function playTTS(text, lang) {
  try {
    haptic('light');
    setOrbState('speaking');

    if (currentAudioElement) {
      currentAudioElement.pause();
    }

    const audioUrl = `/api/tts?text=${encodeURIComponent(text)}&lang=${lang}`;
    currentAudioElement = new Audio(audioUrl);

    currentAudioElement.onended = () => {
      setOrbState('idle');
    };

    currentAudioElement.onerror = () => {
      setOrbState('idle');
    };

    await currentAudioElement.play();
  } catch (err) {
    console.error('Audio playback error:', err);
    setOrbState('idle');
  }
}

// Show Suggestion Pill
function showSuggestion(text) {
  const box = document.getElementById('suggestionBox');
  const btn = document.getElementById('suggestionBtn');
  if (box && btn) {
    btn.textContent = text;
    btn.dataset.text = text;
    box.classList.remove('hidden');
  }
}

// Use Suggestion
function useSuggestion() {
  const btn = document.getElementById('suggestionBtn');
  const text = btn?.dataset?.text;
  if (!text) return;

  const input = document.getElementById('chatInput');
  if (input) {
    input.value = text;
    input.focus();
  }
}

// Load Languages
async function loadLanguages() {
  try {
    const res = await fetch('/api/languages');
    if (res.ok) {
      languagesList = await res.json();
      renderSettingsLanguages();
    }
  } catch (err) {
    console.error('Failed to load languages:', err);
  }
}

// Render Settings Languages Grid
function renderSettingsLanguages() {
  const grid = document.getElementById('settingsLangGrid');
  if (!grid) return;

  grid.innerHTML = languagesList.map(lang => {
    const isSelected = lang.id === currentUser.learning_lang;
    return `
      <button onclick="selectLanguage('${lang.id}')" class="p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${isSelected ? 'bg-sky-500/20 border-sky-500 text-white' : 'bg-slate-800/60 border-white/[0.06] text-slate-300 hover:bg-slate-700/60'}">
        <span class="text-xl">${lang.flag}</span>
        <div class="mt-1">
          <p class="text-xs font-bold truncate">${lang.name}</p>
          <p class="text-[10px] text-slate-400 truncate">${lang.nativeName}</p>
        </div>
      </button>
    `;
  }).join('');
}

// Select Language
async function selectLanguage(langId) {
  haptic('medium');
  currentUser.learning_lang = langId;
  await updateUserSetting('learning_lang', langId);
  updateHeaderUI();
  renderSettingsLanguages();
  switchTab('chat');
}

// Select Level
async function selectLevel(level) {
  haptic('medium');
  currentUser.level = level;
  await updateUserSetting('level', level);
  updateHeaderUI();

  document.querySelectorAll('.level-btn').forEach(btn => {
    if (btn.textContent.trim() === level) {
      btn.className = 'level-btn py-2 rounded-lg bg-sky-500 text-xs font-bold text-white';
    } else {
      btn.className = 'level-btn py-2 rounded-lg bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700';
    }
  });
}

// Load Themes
async function loadThemes() {
  try {
    const res = await fetch('/api/themes');
    if (res.ok) {
      themesList = await res.json();
      renderThemes('all');
    }
  } catch (err) {
    console.error('Failed to load themes:', err);
  }
}

// Filter Themes
function filterThemes(cat) {
  haptic('light');
  document.querySelectorAll('.theme-cat-btn').forEach(btn => {
    btn.classList.remove('bg-sky-500', 'text-white');
    btn.classList.add('bg-slate-800', 'text-slate-300');
  });
  event.target.classList.add('bg-sky-500', 'text-white');
  event.target.classList.remove('bg-slate-800', 'text-slate-300');

  renderThemes(cat);
}

// Render Themes Grid
function renderThemes(category) {
  const grid = document.getElementById('themesGrid');
  if (!grid) return;

  const filtered = category === 'all' ? themesList : themesList.filter(t => t.category === category);

  grid.innerHTML = filtered.map(t => {
    const isCurrent = t.id === currentUser.current_theme;
    return `
      <div onclick="selectTheme('${t.id}')" class="cursor-pointer p-3.5 rounded-2xl border transition relative overflow-hidden flex flex-col justify-between ${isCurrent ? 'bg-gradient-to-tr from-sky-900/40 to-indigo-900/40 border-sky-500 shadow-lg shadow-sky-500/10' : 'bg-slate-800/60 hover:bg-slate-700/60 border-white/[0.06]'}">
        <div class="flex items-start justify-between">
          <span class="text-2xl p-2 rounded-xl bg-slate-900/60 border border-white/[0.06]">${t.icon}</span>
          ${isCurrent ? '<span class="px-2 py-0.5 rounded-full bg-sky-500 text-white text-[10px] font-bold">Actif</span>' : ''}
        </div>
        <div class="mt-3">
          <h4 class="font-display font-bold text-xs sm:text-sm text-white">${escapeHtml(t.name)}</h4>
          <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">${escapeHtml(t.desc)}</p>
        </div>
      </div>
    `;
  }).join('');
}

// Select Theme
async function selectTheme(themeId) {
  haptic('medium');
  currentUser.current_theme = themeId;
  await updateUserSetting('current_theme', themeId);
  updateHeaderUI();
  renderThemes('all');
  
  // Clear chat and ask opening question
  const container = document.getElementById('messagesContainer');
  if (container) container.innerHTML = '';
  
  switchTab('chat');
  setOrbState('thinking');

  const themeObj = themesList.find(t => t.id === themeId);
  setTimeout(() => {
    appendTeacherMessage({
      reply: themeObj?.openingPrompt || "Lass uns anfangen!",
      translationFr: "Commençons notre mise en situation !",
      suggestedReply: "Hallo, ich bin bereit!"
    });
    setOrbState('idle');
  }, 600);
}

// Load SRS Due Words
async function loadSrsDueWords() {
  try {
    const res = await fetch(`/api/srs/words?user_id=${currentUser.user_id}&language=${currentUser.learning_lang}`);
    if (res.ok) {
      const data = await res.json();
      dueWordsList = data.dueWords || [];
      const totalCount = data.totalWords || 0;

      const dueCountEl = document.getElementById('srsDueCount');
      if (dueCountEl) dueCountEl.textContent = dueWordsList.length;

      const totalCountEl = document.getElementById('totalWordsCount');
      if (totalCountEl) totalCountEl.textContent = totalCount;

      renderVocabList(data.allWords || []);
      currentSrsIndex = 0;
      renderActiveSrsCard();
    }
  } catch (err) {
    console.error('Failed to load SRS:', err);
  }
}

// Render Active SRS Card
function renderActiveSrsCard() {
  const card = document.getElementById('flashcard');
  const target = document.getElementById('srsWordTarget');
  const example = document.getElementById('srsWordExample');
  const meaning = document.getElementById('srsWordMeaning');
  const recall = document.getElementById('srsCardRecall');
  const answerArea = document.getElementById('srsAnswerArea');
  const revealBtn = document.getElementById('srsRevealBtnContainer');
  const gradeBtns = document.getElementById('srsGradeBtns');

  if (dueWordsList.length === 0 || currentSrsIndex >= dueWordsList.length) {
    if (target) target.textContent = "🎉 Bravo !";
    if (example) example.textContent = "Toutes vos révisions du jour sont terminées.";
    if (meaning) meaning.textContent = "";
    if (recall) recall.textContent = "[███] À jour";
    answerArea?.classList.add('hidden');
    revealBtn?.classList.add('hidden');
    gradeBtns?.classList.add('hidden');
    return;
  }

  const wordObj = dueWordsList[currentSrsIndex];
  if (target) target.textContent = wordObj.word;
  if (example) example.textContent = wordObj.example_sentence ? `« ${wordObj.example_sentence} »` : '';
  if (meaning) meaning.textContent = wordObj.translation_fr;

  const reps = wordObj.repetitions || 0;
  const bars = reps === 0 ? '[█░░] Niv 1' : (reps === 1 ? '[██░] Niv 2' : '[███] Niv 3');
  if (recall) recall.textContent = bars;

  answerArea?.classList.add('hidden');
  revealBtn?.classList.remove('hidden');
  gradeBtns?.classList.add('hidden');
}

// Reveal SRS Answer
function revealSrsAnswer() {
  haptic('light');
  document.getElementById('srsAnswerArea')?.classList.remove('hidden');
  document.getElementById('srsRevealBtnContainer')?.classList.add('hidden');
  document.getElementById('srsGradeBtns')?.classList.remove('hidden');
}

// Grade SRS Card
async function gradeSrsCard(grade) {
  haptic('medium');
  const wordObj = dueWordsList[currentSrsIndex];
  if (!wordObj) return;

  try {
    await fetch('/api/srs/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        word_id: wordObj.id,
        grade: grade
      })
    });

    currentSrsIndex++;
    renderActiveSrsCard();
  } catch (err) {
    console.error('Failed to submit grade:', err);
  }
}

// Render Vocab List
function renderVocabList(words) {
  const container = document.getElementById('vocabList');
  if (!container) return;

  if (words.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-500 italic p-2">Aucun mot enregistré pour le moment. Discutez avec le tuteur pour enrichir votre carnet !</p>`;
    return;
  }

  container.innerHTML = words.map(w => `
    <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-white/[0.04] text-xs">
      <div>
        <span class="font-bold text-white">${escapeHtml(w.word)}</span>
        <span class="text-slate-400 text-[11px] ml-2">→ ${escapeHtml(w.translation_fr)}</span>
      </div>
      <button onclick="playTTS('${escapeQuote(w.word)}', '${currentUser.learning_lang}')" class="text-sky-400 hover:text-sky-300 p-1">
        🔊
      </button>
    </div>
  `).join('');
}

// Update User Setting via API
async function updateUserSetting(key, value) {
  try {
    await fetch('/api/user/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.user_id,
        setting: key,
        value: value
      })
    });
  } catch (err) {
    console.error('Failed to update setting:', err);
  }
}

// Reset Conversation
async function resetConversation() {
  if (confirm('Voulez-vous réinitialiser le contexte de conversation ?')) {
    haptic('warning');
    const container = document.getElementById('messagesContainer');
    if (container) container.innerHTML = '';
    renderInitialMessage();
    switchTab('chat');
  }
}

// Helpers
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function escapeQuote(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
