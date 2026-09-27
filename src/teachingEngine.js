import { getLanguage } from './languages.js';
import { getTheme } from './themes.js';
import { createGroqChatCompletion } from './groqClient.js';
import { addOrUpdateWord } from './database.js';

export function buildSystemPrompt(user) {
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);
  const level = user.level || 'A1';
  const levelFocus = lang.teachingFocus[level] || lang.teachingFocus.A1 || lang.teachingFocus.B2;

  return `
You are Fluence, an expert native language teacher and personal tutor helping the learner master ${lang.name} (${lang.nativeName}).
Your current target level is CEFR ${level}.
Learner support language is French (Français).

══════════════════════════════════════════════════════════════════
TRUE TEACHER & PEDAGOGICAL METHOD RULES:
══════════════════════════════════════════════════════════════════
1. ACT AS A REAL DEDICATED TEACHER:
   - Teach structured micro-lessons: introduce new vocabulary, explain grammar points simply, and ask the student to construct or repeat sentences.
   - If the student makes a mistake, immediately provide a clear, gentle explanation in French and give the correct sentence to repeat.
2. STRICT ANTI-REPETITION RULE:
   - NEVER start or repeat the same repetitive chit-chat questions ("Wie geht's?", "Was machst du heute?").
   - Move forward with new topics, concrete situations, roleplay, and active learning drills.
3. ADAPT TO CEFR ${level}:
   - Focus: "${levelFocus}".
   - Keep sentences clear and accessible, and end each turn with ONE specific question or prompt.
4. Scenario / Theme: ${theme.title} (${theme.situation}).
5. ${lang.speechGuidance} ${lang.writingGuidance}
══════════════════════════════════════════════════════════════════

OUTPUT FORMAT REQUIREMENTS:
You MUST respond using this exact structured format with distinct sections:

---REPLY---
[Your natural conversational reply in ${lang.name} adhering to ${level} level]

---TRANSLATION---
[Faithful French translation of your reply for subtitles/comprehension aid]

---CORRECTION---
[If the user made a meaningful grammatical, lexical or syntax error in their previous message, provide a gentle, polite recast and brief explanation in French. If user made no errors or this is the start of conversation, write: NONE]

---VOCABULARY---
[Identify 1-3 useful key words, idioms or medical/daily expressions used in this turn. Format each on a line: Word || French Meaning || Short Example Sentence. If none, write: NONE]

---SUGGESTION---
[Provide 1 natural, helpful sentence in ${lang.name} that the learner could use to reply or continue the conversation]
`.trim();
}

export function parseStructuredResponse(rawOutput, langId = 'de') {
  const result = {
    reply: '',
    translationFr: '',
    correction: null,
    vocabulary: [],
    suggestedReply: ''
  };

  if (!rawOutput) return result;

  const sections = {
    reply: /---REPLY---([\s\S]*?)(?=---TRANSLATION---|---CORRECTION---|---VOCABULARY---|---SUGGESTION---|$)/i,
    translation: /---TRANSLATION---([\s\S]*?)(?=---CORRECTION---|---VOCABULARY---|---SUGGESTION---|$)/i,
    correction: /---CORRECTION---([\s\S]*?)(?=---VOCABULARY---|---SUGGESTION---|$)/i,
    vocabulary: /---VOCABULARY---([\s\S]*?)(?=---SUGGESTION---|$)/i,
    suggestion: /---SUGGESTION---([\s\S]*?)$/i
  };

  const replyMatch = rawOutput.match(sections.reply);
  const transMatch = rawOutput.match(sections.translation);
  const corrMatch = rawOutput.match(sections.correction);
  const vocabMatch = rawOutput.match(sections.vocabulary);
  const suggMatch = rawOutput.match(sections.suggestion);

  if (replyMatch && replyMatch[1].trim()) {
    result.reply = replyMatch[1].trim();
  } else {
    // If format tags were omitted by model, use raw text cleaned
    result.reply = rawOutput.replace(/---[A-Z]+---/g, '').trim();
  }

  if (transMatch && transMatch[1].trim()) {
    result.translationFr = transMatch[1].trim();
  }

  if (corrMatch && corrMatch[1].trim() && !corrMatch[1].includes('NONE')) {
    result.correction = corrMatch[1].trim();
  }

  if (vocabMatch && vocabMatch[1].trim() && !vocabMatch[1].includes('NONE')) {
    const lines = vocabMatch[1].trim().split('\n');
    for (const line of lines) {
      const parts = line.split('||').map(p => p.trim().replace(/^[-•*]\s*/, ''));
      if (parts.length >= 2 && parts[0] && parts[1]) {
        result.vocabulary.push({
          word: parts[0],
          translation: parts[1],
          example: parts[2] || ''
        });
      }
    }
  }

  // Check adaptive CEFR progression
  if (user) {
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const currIdx = levels.indexOf(user.level || 'B2');
    user.turnCount = (user.turnCount || 0) + 1;
    // Every 6 successful turns without major breakdowns, promote to next CEFR level
    if (user.turnCount >= 6 && currIdx >= 0 && currIdx < levels.length - 1) {
      user.turnCount = 0;
      user.level = levels[currIdx + 1];
      result.levelPromotion = user.level;
    }
  }

  if (suggMatch && suggMatch[1].trim()) {
    result.suggestedReply = suggMatch[1].trim().replace(/^[-•*]\s*/, '');
  }

  return result;
}

export async function processUserMessage(user, userText, history = []) {
  const systemPrompt = buildSystemPrompt(user);
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userText }
  ];

  const raw = await createGroqChatCompletion(messages, user.groq_model, user.groq_api_key);
  const parsed = parseStructuredResponse(raw, user.learning_lang);

  // Auto-save discovered vocabulary words to user's SRS deck
  if (parsed.vocabulary && parsed.vocabulary.length > 0) {
    for (const v of parsed.vocabulary) {
      try {
        addOrUpdateWord(user.user_id, user.learning_lang, v.word, v.translation, v.example);
      } catch (err) {
        console.error('Error auto-adding word to SRS:', err);
      }
    }
  }

  return parsed;
}

export async function generateThemeStarter(user) {
  const lang = getLanguage(user.learning_lang);
  const theme = getTheme(user.current_theme);
  const level = user.level || 'B2';

  const prompt = `
You are Mural, teaching ${lang.name} at CEFR ${level}.
Initiate the conversation for the scenario: "${theme.title}" (${theme.situation}).
Greet the learner warmly in ${lang.name}, set up the scene in 1-2 lively sentences, and ask a relevant first question.
Follow the exact structured format:
---REPLY---
[Your opening in ${lang.name}]
---TRANSLATION---
[French translation]
---CORRECTION---
NONE
---VOCABULARY---
[1-2 introductory vocabulary words || French meaning || Example]
---SUGGESTION---
[A simple phrase the learner can say to respond]
`.trim();

  const messages = [
    { role: 'system', content: buildSystemPrompt(user) },
    { role: 'user', content: prompt }
  ];

  const raw = await createGroqChatCompletion(messages, user.groq_model, user.groq_api_key);
  const parsed = parseStructuredResponse(raw, user.learning_lang);

  if (parsed.vocabulary && parsed.vocabulary.length > 0) {
    for (const v of parsed.vocabulary) {
      try {
        addOrUpdateWord(user.user_id, user.learning_lang, v.word, v.translation, v.example);
      } catch (err) {}
    }
  }

  return parsed;
}

export async function explainWordDetails(word, user) {
  const lang = getLanguage(user.learning_lang);
  const prompt = `
Explain the ${lang.name} word/expression "${word}" in French for a ${user.level || 'B2'} level student.
Include:
1. Exact grammatical category & gender (if noun)
2. French translation and nuances
3. 2 clear, practical example sentences with French translations
4. Common collocations or medical/daily usage tips
Keep the response structured and easy to read.
`.trim();

  const messages = [
    { role: 'system', content: `You are a linguist and language tutor specializing in ${lang.name}.` },
    { role: 'user', content: prompt }
  ];

  return await createGroqChatCompletion(messages, user.groq_model, user.groq_api_key);
}
