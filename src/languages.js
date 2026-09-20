export const LANGUAGES = {
  de: {
    id: 'de',
    code: 'de-DE',
    ttsCode: 'de',
    flag: '🇩🇪',
    name: 'Allemand',
    nativeName: 'Deutsch',
    greeting: 'Hallo! Wie geht es dir heute?',
    speechGuidance: 'Sprich klares Standarddeutsch (Hochdeutsch). Verwende eine natürliche, freundliche Intonation.',
    writingGuidance: 'Verwende korrekte Groß- und Kleinschreibung für Substantive und achte auf die Satzstellung (Verbzweitstellung im Hauptsatz, Verbletztstellung im Nebensatz).',
    teachingFocus: {
      A1: 'Einfache Sätze im Präsens, grundlegender Wortschatz für den Alltag.',
      A2: 'Perfekt mit haben/sein, Modalverben, einfache Beschreibungen von Erlebnissen.',
      B1: 'Nebensätze mit weil/dass/obwohl, Konjunktiv II für Wünsche, Meinungsäußerungen.',
      B2: 'Flüssige Diskussion, Passiv, Partizipialkonstruktionen, Nomen-Verb-Verbindungen, medizinisches und professionelles Vokabular.',
      C1: 'Komplexe Redewendungen, stilistische Nuancen, präzise Argumentation und Fachsprache.',
      C2: 'Muttersprachliches Niveau, subtile Ironie, idiomatische Meisterschaft.'
    }
  },
  es: {
    id: 'es',
    code: 'es-ES',
    ttsCode: 'es',
    flag: '🇪🇸',
    name: 'Espagnol',
    nativeName: 'Español',
    greeting: '¡Hola! ¿Cómo estás hoy?',
    speechGuidance: 'Habla español claro y natural de España con entonación cálida.',
    writingGuidance: 'Usa signos de apertura (¿ ¡) y tildes correctamente.',
    teachingFocus: {
      A1: 'Presente simple, saludos y necesidades básicas.',
      A2: 'Pretérito indefinido y perfecto, descripciones de rutinas.',
      B1: 'Subjuntivo presente, expresar dudas y opiniones.',
      B2: 'Subjuntivo imperfecto, estilo indirecto, vocabulario profesional.',
      C1: 'Expresiones idiomáticas complejas, matices de registro formal.',
      C2: 'Dominio nativo y fluidez absoluta.'
    }
  },
  en: {
    id: 'en',
    code: 'en-US',
    ttsCode: 'en',
    flag: '🇬🇧',
    name: 'Anglais',
    nativeName: 'English',
    greeting: 'Hello there! How are you doing today?',
    speechGuidance: 'Speak natural, clear international English with a welcoming tone.',
    writingGuidance: 'Use natural punctuation and contractions where appropriate.',
    teachingFocus: {
      A1: 'Basic present simple, essential everyday vocabulary.',
      A2: 'Past simple, future with going to, daily routines.',
      B1: 'Present perfect, conditionals, expressing thoughts.',
      B2: 'Complex phrasal verbs, idioms, professional discussions.',
      C1: 'Subtle nuance, advanced argumentation, formal registers.',
      C2: 'Near-native mastery and cultural references.'
    }
  },
  it: {
    id: 'it',
    code: 'it-IT',
    ttsCode: 'it',
    flag: '🇮🇹',
    name: 'Italien',
    nativeName: 'Italiano',
    greeting: 'Ciao! Come va oggi?',
    speechGuidance: 'Parla un italiano standard espressivo e melodioso.',
    writingGuidance: 'Usa accenti corretti e concordanze precise.',
    teachingFocus: {
      A1: 'Presente indicativo, formule di cortesia e vita quotidiana.',
      A2: 'Passato prossimo, pronomi diretti, descrizioni.',
      B1: 'Congiuntivo presente, condizionale, esprimere opinioni.',
      B2: 'Congiuntivo imperfetto, periodi ipotetici, lessico ricco.',
      C1: 'Sfumature stilistiche, registro formale e idiomi.',
      C2: 'Padronanza totale della lingua.'
    }
  },
  fr: {
    id: 'fr',
    code: 'fr-FR',
    ttsCode: 'fr',
    flag: '🇫🇷',
    name: 'Français',
    nativeName: 'Français',
    greeting: 'Bonjour ! Comment vas-tu aujourd’hui ?',
    speechGuidance: 'Parle un français soigné et chaleureux.',
    writingGuidance: 'Respecte les accords grammaticaux et la ponctuation.',
    teachingFocus: {
      A1: 'Présent, vocabulaire du quotidien et présentations.',
      A2: 'Passé composé, imparfait, vie courante.',
      B1: 'Subjonctif présent, argumentation et nuances.',
      B2: 'Concordance des temps, vocabulaire médical et professionnel.',
      C1: 'Figures de style, tournures élégantes et soutenu.',
      C2: 'Éloquence et maîtrise totale.'
    }
  },
  pt: {
    id: 'pt',
    code: 'pt-BR',
    ttsCode: 'pt',
    flag: '🇧🇷',
    name: 'Portugais',
    nativeName: 'Português (Brasil)',
    greeting: 'Olá! Tudo bem com você hoje?',
    speechGuidance: 'Fale português brasileiro coloquial, suave e acolhedor.',
    writingGuidance: 'Use acentuação correta e pronomes naturais.',
    teachingFocus: {
      A1: 'Presente simples e vocabulário cotidiano.',
      A2: 'Pretérito perfeito e imperfeito.',
      B1: 'Subjuntivo presente, expressar desejos e opiniões.',
      B2: 'Expressões idiomáticas brasileiras, fluência conversacional.',
      C1: 'Vocabulário técnico e nuances formais.',
      C2: 'Domínio nativo e literário.'
    }
  },
  nb: {
    id: 'nb',
    code: 'nb-NO',
    ttsCode: 'no',
    flag: '🇳🇴',
    name: 'Norvégien',
    nativeName: 'Norsk Bokmål',
    greeting: 'Hei! Hvordan går det med deg i dag?',
    speechGuidance: 'Snakk tydelig østnorsk med rolig tone.',
    writingGuidance: 'Følg standard bokmålsrettskrivning og V2-regelen.',
    teachingFocus: {
      A1: 'Enkle setninger i presens, daglige fraser.',
      A2: 'Preteritum, modale hjelpeverb, stedsuttrykk.',
      B1: 'Leddsetninger med ordstilling (IKKE), samtaler.',
      B2: 'Flytende diskusjon, faste uttrykk, samfunnstemaer.',
      C1: 'Avansert idiomatikk og formell stil.',
      C2: 'Fullstendig mestring av språket.'
    }
  },
  zh: {
    id: 'zh',
    code: 'zh-CN',
    ttsCode: 'zh-CN',
    flag: '🇨🇳',
    name: 'Chinois Mandarin',
    nativeName: '中文 (普通话)',
    greeting: '你好！今天过得怎么样？',
    speechGuidance: '使用标准普通话，发音清晰，注意四声声调。',
    writingGuidance: '使用简体汉字，必要时附带拼音注解。',
    teachingFocus: {
      A1: '基础句型，声调识别，日常问候。',
      A2: '常用动词重叠，时态助词（了/过/着）。',
      B1: '复句连接词，把字句，被字句，日常交流。',
      B2: '成语运用，复杂话题讨论，商务与专业词汇。',
      C1: '高级书面语，文化深层讨论。',
      C2: '母语级表达与古汉语典故。'
    }
  },
  ro: {
    id: 'ro',
    code: 'ro-RO',
    ttsCode: 'ro',
    flag: '🇷🇴',
    name: 'Roumain',
    nativeName: 'Română',
    greeting: 'Salut! Ce mai faci astăzi?',
    speechGuidance: 'Vorbește o română standard clară și prietenoasă.',
    writingGuidance: 'Folosește diacriticele corecte (ă, â, î, ș, ț).',
    teachingFocus: {
      A1: 'Prezentul simplu, formule de politețe de bază.',
      A2: 'Perfectul compus, viitorul simplu.',
      B1: 'Conjunctivul, exprimarea opiniei și a dorințelor.',
      B2: 'Fraze complexe, vocabular specific și profesional.',
      C1: 'Nuanțe stilistice și expresii idiomatice.',
      C2: 'Stăpânire nativă completă.'
    }
  },
  ar: {
    id: 'ar',
    code: 'ar-SA',
    ttsCode: 'ar',
    flag: '🇸🇦',
    name: 'Arabe',
    nativeName: 'العربية الفصحى',
    greeting: 'أهلاً وسهلاً! كيف حالك اليوم؟',
    speechGuidance: 'تحدث باللغة العربية الفصحى المعاصرة بنبرة واضحة ومخارج حروف دقيقة.',
    writingGuidance: 'استخدم علامات الترقيم والإملاء العربي الصحيح مع ضبط الحركات عند الحاجة.',
    teachingFocus: {
      A1: 'الجمل الاسمية والفعلية البسيطة والتحيات اليومية.',
      A2: 'الأفعال الماضية والمضارعة والضمائر المتصلة.',
      B1: 'أدوات النصب والجزم والمحادثات المتنوعة.',
      B2: 'النقاشات الفكرية والمفردات التخصصية المتقدمة.',
      C1: 'البلاغة والأساليب الأدبية والبيان.',
      C2: 'الفصاحة والتمكن اللغوي التام.'
    }
  },
  ru: {
    id: 'ru',
    code: 'ru-RU',
    ttsCode: 'ru',
    flag: '🇷🇺',
    name: 'Russe',
    nativeName: 'Русский',
    greeting: 'Привет! Как твои дела сегодня?',
    speechGuidance: 'Говорите на чистом литературном русском языке с мягкой интонацией.',
    writingGuidance: 'Соблюдайте правила падежей и видовых пар глаголов.',
    teachingFocus: {
      A1: 'Простые фразы в настоящем времени, базовые падежи.',
      A2: 'Прошедшее время, глаголы движения, повседневные темы.',
      B1: 'Виды глаголов, деепричастия, выражение мнения.',
      B2: 'Сложные синтаксические конструкции, идиомы, профессиональная речь.',
      C1: 'Стилистическое богатство, публицистика и литература.',
      C2: 'Абсолютное владение языком.'
    }
  },
  ja: {
    id: 'ja',
    code: 'ja-JP',
    ttsCode: 'ja',
    flag: '🇯🇵',
    name: 'Japonais',
    nativeName: '日本語',
    greeting: 'こんにちは！今日の調子はいかがですか？',
    speechGuidance: '標準的な日本語で、丁寧な「です・ます」調を基本として話します。',
    writingGuidance: '漢字・ひらがな・カタカナを適切に使い分けます。',
    teachingFocus: {
      A1: '基本的な挨拶、です/ます形、自己紹介。',
      A2: 'て形、ない形、日常的な行動の描写。',
      B1: '敬語の基礎、条件形、自分の考えを述べる。',
      B2: '敬語（尊敬語・謙譲語）、ビジネス日本語、議論。',
      C1: '高度な語彙、慣用句、抽象的な議論。',
      C2: 'ネイティブレベルの表現力。'
    }
  }
};

export function getLanguage(langId) {
  const key = (langId || 'de').toLowerCase();
  return LANGUAGES[key] || LANGUAGES.de;
}

export function getAllLanguages() {
  return Object.values(LANGUAGES);
}
