# 🎨 Mural Teacher · Telegram AI Language Tutor

Un bot Telegram d'apprentissage des langues immersif, intelligent et interactif, basé sur la pédagogie de l'application **Mural** et optimisé selon les standards **UI/UX Pro Max**.

---

## 🌟 Fonctionnalités & Expérience UI/UX

### 1. 💬 Immersion & Pédagogie Conversationnelle
- **12 Langues supportées** : Allemand 🇩🇪 (Focus B2), Espagnol 🇪🇸, Anglais 🇬🇧, Italien 🇮🇹, Français 🇫🇷, Portugais 🇧🇷, Norvégien 🇳🇴, Chinois Mandarin 🇨🇳, Roumain 🇷🇴, Arabe 🇸🇦, Russe 🇷🇺, Japonais 🇯🇵.
- **Niveaux CEFR Adaptatifs (A1 à C2)** : Adaptation dynamique du vocabulaire, des structures de phrases et de la complexité.
- **Correction Bienveillante (Recasting)** : Détection et explication en français des erreurs de grammaire et de syntaxe.
- **Sous-titres & Traduction** : Révélation en accordéon repliable (`<blockquote expandable>`) pour une compréhension sans effort.

### 2. 🎭 24 Scénarios & Mises en Situation
- **Quotidien & Pratique** : Au Café, Supermarché, Visite de logement, Routine, Pharmacie, Transports.
- **Professionnel & Médical** : Consultation médicale / Hôpital, Entretien d'embauche, Appels pros, Réunions d'équipe.
- **Voyage & Aventure** : Aéroport & Douane, Hôtel, Demander son chemin, Dégustation gastronomique.
- **Société & Culture** : Cinéma & Séries, Débats d'actualité, Sports, Philosophie & Conversation libre.

### 3. 🧠 Mémorisation Espacée (SRS SuperMemo-2)
- **Extraction automatique** : Chaque nouveau mot ou expression rencontré en discussion est enregistré dans votre Carnet personnel.
- **Cartes de Révision Interactives** : Flashcards recto-verso avec auto-évaluation en 4 niveaux (`🔴 À revoir`, `🟧 Difficile`, `🟦 Bon`, `🟩 Facile`).
- **Jauges de Maîtrise & Streaks** : Suivi des séries d'assiduité (`🔥 7 jours`), barres de progression et statut des cartes (`[█░░]`, `[██░]`, `[███]`).

### 4. 🎙️ Entraînement Oral & Audio (STT / TTS)
- **Synthèse Vocale (TTS)** : Bouton `🎧 Écouter` sur chaque réplique pour écouter la prononciation native.
- **Reconnaissance Vocale (Whisper STT)** : Envoyez une note vocale Telegram, le bot transcrit et répond oralement.

---

## 🚀 Démarrage Rapide

1. **Installer les dépendances :**
   ```bash
   npm install
   ```

2. **Configurer l'environnement :**
   Copiez `.env.example` vers `.env` et ajoutez vos clés :
   ```env
   TELEGRAM_BOT_TOKEN=votre_token_botfather
   GROQ_API_KEY=votre_cle_groq
   ```

3. **Lancer le Bot :**
   ```bash
   npm start
   ```
