#!/usr/bin/env bash
# Mural Teacher Bot & Mini App Runner

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -f .env ]; then
  echo "⚠️ Le fichier .env est manquant. Création depuis .env.example..."
  cp .env.example .env
fi

echo "🚀 Démarrage de Mural Teacher Bot (@MuralTeacherBot)..."
exec node src/bot.js
