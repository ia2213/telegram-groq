export const THEME_CATEGORIES = [
  {
    id: 'daily',
    name: '🌟 Quotidien & Pratique',
    icon: '☕'
  },
  {
    id: 'professional',
    name: '💼 Pro & Médical',
    icon: '🏥'
  },
  {
    id: 'travel',
    name: '✈️ Voyage & Découverte',
    icon: '🌍'
  },
  {
    id: 'culture',
    name: '🗣️ Débats & Société',
    icon: '🎭'
  }
];

export const THEMES = {
  // --- Daily Life ---
  cafe_restaurant: {
    id: 'cafe_restaurant',
    category: 'daily',
    icon: '☕',
    title: 'Au Café & Restaurant',
    subtitle: 'Commander, demander des conseils, payer l’addition',
    situation: 'You are at a lively café or traditional restaurant. The teacher is a friendly waiter/barista greeting the customer and taking an order.'
  },
  supermarket: {
    id: 'supermarket',
    category: 'daily',
    icon: '🛒',
    title: 'Au Supermarché & Marché',
    subtitle: 'Acheter des ingrédients, demander des prix et des conseils',
    situation: 'You are shopping at a local grocery market. The teacher is a merchant offering fresh regional produce and discussing ingredients.'
  },
  housing: {
    id: 'housing',
    category: 'daily',
    icon: '🏠',
    title: 'Visite de Logement',
    subtitle: 'Poser des questions sur un bail, le loyer et les charges',
    situation: 'You are visiting an apartment for rent. The teacher is the landlord or real estate agent presenting the rooms and discussing terms.'
  },
  daily_routine: {
    id: 'daily_routine',
    category: 'daily',
    icon: '🌅',
    title: 'Routine & Habitudes',
    subtitle: 'Raconter sa journée, ses loisirs et ses projets de week-end',
    situation: 'A casual conversation about daily schedules, sleep, breakfast habits, work rhythm, and hobbies.'
  },
  pharmacy: {
    id: 'pharmacy',
    category: 'daily',
    icon: '💊',
    title: 'À la Pharmacie',
    subtitle: 'Expliquer des symptômes bénins et demander un médicament',
    situation: 'You have a minor health issue (headache, cold, sore throat) and are asking the pharmacist for advice and dosage.'
  },
  transport: {
    id: 'transport',
    category: 'daily',
    icon: '🚆',
    title: 'Transports en Commun',
    subtitle: 'Acheter un billet de train, demander des correspondances',
    situation: 'You are at the central railway station asking for the quickest connection, platform info, and ticket discounts.'
  },

  // --- Professional & Medical ---
  hospital_consultation: {
    id: 'hospital_consultation',
    category: 'professional',
    icon: '🏥',
    title: 'Consultation Médicale / Hôpital',
    subtitle: 'Anamnèse, examen clinique, diagnostic et prescription',
    situation: 'A clinical medical conversation in a hospital setting. The teacher acts as an Assistenzarzt / colleague or patient presenting medical cases, symptoms, and treatment plans.'
  },
  job_interview: {
    id: 'job_interview',
    category: 'professional',
    icon: '💼',
    title: 'Entretien d’Embauche',
    subtitle: 'Présenter son CV, ses points forts et ses motivations',
    situation: 'You are in a job interview for a hospital residency or company position. The teacher is an interviewer evaluating background and skills.'
  },
  phone_call: {
    id: 'phone_call',
    category: 'professional',
    icon: '📞',
    title: 'Appel Téléphonique Pro',
    subtitle: 'Prendre un rendez-vous, annuler, demander des précisions',
    situation: 'A realistic professional phone call to book an appointment with a clinic or administration, leaving voicemail if needed.'
  },
  team_meeting: {
    id: 'team_meeting',
    category: 'professional',
    icon: '🤝',
    title: 'Réunion d’Équipe & Projet',
    subtitle: 'Partager son avis, défendre une proposition, arbitrer',
    situation: 'A collaborative work meeting discussing project deadlines, patient rounds, or team organization.'
  },
  academic_debate: {
    id: 'academic_debate',
    category: 'professional',
    icon: '🎓',
    title: 'Discussion Scientifique & Études',
    subtitle: 'Présenter une étude de recherche ou un cas d’étude',
    situation: 'Discussing recent medical research papers, scientific methodology, exam preparation, and evidence-based medicine.'
  },
  emergency_triage: {
    id: 'emergency_triage',
    category: 'professional',
    icon: '🚑',
    title: 'Urgences & Triage',
    subtitle: 'Gérer une situation critique avec calme et clarté',
    situation: 'Emergency room scenario managing urgent admissions, quick diagnostic triage, and clear nurse-doctor communication.'
  },

  // --- Travel & Exploration ---
  airport_customs: {
    id: 'airport_customs',
    category: 'travel',
    icon: '✈️',
    title: 'Aéroport & Douane',
    subtitle: 'Enregistrement, contrôle des passeports, bagages perdus',
    situation: 'Navigating international airport check-in, border security, baggage claim, and flight delay announcements.'
  },
  hotel_checkin: {
    id: 'hotel_checkin',
    category: 'travel',
    icon: '🏨',
    title: 'À l’Hôtel',
    subtitle: 'Check-in, demander un service en chambre, résoudre un imprévu',
    situation: 'Checking into a hotel, inquiring about breakfast hours, Wi-Fi, laundry service, or requesting a quiet room change.'
  },
  asking_directions: {
    id: 'asking_directions',
    category: 'travel',
    icon: '🗺️',
    title: 'Demander son Chemin',
    subtitle: 'S’orienter en ville, trouver un monument ou un métro',
    situation: 'You are lost in a historic city center asking a friendly local for directions to a landmark, pharmacy, or metro station.'
  },
  gastronomy: {
    id: 'gastronomy',
    category: 'travel',
    icon: '🍽️',
    title: 'Découverte Gastronomique',
    subtitle: 'Discuter des spécialités culinaires et des traditions',
    situation: 'Exploring local food culture, discussing cooking recipes, regional wines, and tasting menus with a culinary enthusiast.'
  },
  museum_tour: {
    id: 'museum_tour',
    category: 'travel',
    icon: '🏛️',
    title: 'Visite de Musée & Histoire',
    subtitle: 'Explorer une exposition d’art et échanger ses impressions',
    situation: 'Visiting an art gallery or historical museum, discussing paintings, historical eras, and museum architecture.'
  },
  outdoor_adventure: {
    id: 'outdoor_adventure',
    category: 'travel',
    icon: '🏔️',
    title: 'Randonnée & Nature',
    subtitle: 'Préparer un itinéraire en montagne, météo et équipement',
    situation: 'Planning a hiking trip in the Alps or Black Forest, discussing weather forecasts, trail difficulty, and safety gear.'
  },

  // --- Culture & Society ---
  cinema_literature: {
    id: 'cinema_literature',
    category: 'culture',
    icon: '🎬',
    title: 'Cinéma, Séries & Livres',
    subtitle: 'Partager ses critiques, analyser des intrigues et personnages',
    situation: 'Debating favourite movies, TV series, literary classics, directors, and cultural impacts with a fellow fan.'
  },
  current_events: {
    id: 'current_events',
    category: 'culture',
    icon: '📰',
    title: 'Actualités & Société',
    subtitle: 'Donner son avis sur les grandes nouvelles du moment',
    situation: 'Discussing technological advances (AI), ecology, healthcare reforms, and contemporary social trends.'
  },
  sports_fitness: {
    id: 'sports_fitness',
    category: 'culture',
    icon: '⚽',
    title: 'Sport & Bien-être',
    subtitle: 'Parler de ses entraînements, clubs favoris et nutrition',
    situation: 'Discussing training routines, football championships, running, gym workouts, and healthy nutrition habits.'
  },
  music_festivals: {
    id: 'music_festivals',
    category: 'culture',
    icon: '🎵',
    title: 'Musique & Concerts',
    subtitle: 'Styles musicaux, instruments, artistes et festivals',
    situation: 'Talking about musical tastes (classical, jazz, electro, indie), attending concerts, and playing instruments.'
  },
  philosophy_life: {
    id: 'philosophy_life',
    category: 'culture',
    icon: '🧠',
    title: 'Philosophie & Pensée',
    subtitle: 'Réflexions sur le bonheur, le temps et les choix de vie',
    situation: 'Deep thoughtful exchange on personal values, ethical dilemmas, lifelong learning, and human nature.'
  },
  free_talk: {
    id: 'free_talk',
    category: 'culture',
    icon: '💭',
    title: 'Conversation Libre',
    subtitle: 'Discutez spontanément de ce qui vous passe par la tête',
    situation: 'An open-ended, spontaneous friendly chat tailored to the learner’s mood, current thoughts, and personal interests.'
  }
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES.free_talk;
}

export function getThemesByCategory(catId) {
  return Object.values(THEMES).filter(t => t.category === catId);
}

export function getAllThemes() {
  return Object.values(THEMES);
}
