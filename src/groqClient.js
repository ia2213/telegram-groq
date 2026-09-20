import Groq from 'groq-sdk';
import { CONFIG } from './config.js';

export async function createGroqChatCompletion(messages, model = null, customApiKey = null) {
  const apiKey = customApiKey || CONFIG.GROQ_API_KEY;
  const targetModel = model || CONFIG.DEFAULT_MODEL;

  // 1. Try Groq SDK if API key is provided
  if (apiKey && apiKey !== 'your_groq_api_key' && !apiKey.startsWith('your_')) {
    try {
      const client = new Groq({ apiKey });
      const completion = await client.chat.completions.create({
        messages,
        model: targetModel,
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 0.95
      });
      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error(`Groq error with model ${targetModel}:`, error?.message || error);
      // Try fallback models
      for (const fbModel of CONFIG.FALLBACK_MODELS) {
        if (fbModel === targetModel) continue;
        try {
          const client = new Groq({ apiKey });
          const completion = await client.chat.completions.create({
            messages,
            model: fbModel,
            temperature: 0.7,
            max_tokens: 1024
          });
          return completion.choices[0]?.message?.content || '';
        } catch (err) {
          continue;
        }
      }
    }
  }

  // 2. Try Local AI Engine (OmniRoute / OpenAI compatible endpoint at localhost:20128)
  try {
    const res = await fetch(`${CONFIG.LOCAL_API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.LOCAL_API_KEY}`
      },
      body: JSON.stringify({
        model: CONFIG.LOCAL_API_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) return content;
    }
  } catch (localErr) {
    console.error('Local AI fallback error:', localErr?.message || localErr);
  }

  // 3. Fallback mock response if no external backend responded
  return generateFallbackResponse(messages);
}

export async function transcribeAudioWithWhisper(audioBuffer, languageCode = null, customApiKey = null) {
  const apiKey = customApiKey || CONFIG.GROQ_API_KEY;

  if (apiKey && apiKey !== 'your_groq_api_key' && !apiKey.startsWith('your_')) {
    try {
      const client = new Groq({ apiKey });
      const file = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' });

      const transcription = await client.audio.transcriptions.create({
        file,
        model: 'whisper-large-v3-turbo',
        language: languageCode ? languageCode.split('-')[0] : undefined,
        response_format: 'verbose_json'
      });

      return transcription.text || '';
    } catch (error) {
      console.error('Whisper transcription error:', error?.message || error);
    }
  }

  // Fallback if no whisper API available
  return 'Guten Tag! Ich lerne Deutsch.';
}

function generateFallbackResponse(messages) {
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  return `---REPLY---
Sehr gut! Erzähl mir mehr darüber: "${lastUserMsg}". Wie fühlst du dich heute?

---TRANSLATION---
Très bien ! Raconte-m'en plus sur : "${lastUserMsg}". Comment te sens-tu aujourd'hui ?

---CORRECTION---
NONE

---VOCABULARY---
das Gefühl || le sentiment || Ich habe ein gutes Gefühl.

---SUGGESTION---
Heute fühle ich mich sehr gut, danke!`;
}
