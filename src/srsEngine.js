export function calculateSM2(grade, currentInterval = 1, currentEase = 2.5, repetitions = 0) {
  let newReps = repetitions;
  let newInterval = currentInterval;
  let newEase = currentEase;

  if (grade < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) {
      newInterval = 1;
    } else if (newReps === 2) {
      newInterval = 4;
    } else {
      newInterval = Math.round(currentInterval * currentEase);
    }

    if (grade === 2) {
      newInterval = Math.max(1, Math.floor(newInterval * 0.75));
    } else if (grade === 4) {
      newInterval = Math.max(2, Math.floor(newInterval * 1.3));
    }
  }

  newEase = currentEase + (0.1 - (4 - grade) * (0.08 + (4 - grade) * 0.02));
  newEase = Math.max(1.3, Math.min(3.0, Math.round(newEase * 100) / 100));

  const dueDateObj = new Date(Date.now() + newInterval * 86400000);
  const dueDate = dueDateObj.toISOString().split('T')[0];

  return {
    interval: newInterval,
    easeFactor: newEase,
    repetitions: newReps,
    dueDate
  };
}

export function getRecallBars(repetitions) {
  if (repetitions >= 4) {
    return '🟩 [███] Maîtrisé';
  } else if (repetitions >= 2) {
    return '🟨 [██░] En cours';
  } else if (repetitions >= 1) {
    return '🟧 [█░░] Découverte';
  }
  return '⬜ [░░░] Nouveau';
}

export function generateProgressBar(current, total, width = 10) {
  if (total <= 0) return `[${'░'.repeat(width)}] 0%`;
  const ratio = Math.min(1.0, Math.max(0.0, current / total));
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const percent = Math.round(ratio * 100);
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${percent}%`;
}

export function getStreakBadge(streakDays) {
  if (streakDays >= 30) {
    return { badge: '👑', title: 'Polyglotte d’Élite' };
  } else if (streakDays >= 14) {
    return { badge: '💎', title: 'Champion Assidu' };
  } else if (streakDays >= 7) {
    return { badge: '🔥', title: 'Série Ardente' };
  } else if (streakDays >= 3) {
    return { badge: '⚡', title: 'Bonne Dynamique' };
  } else if (streakDays >= 1) {
    return { badge: '🌱', title: 'Premier Pas' };
  }
  return { badge: '⏳', title: 'Prêt à débuter' };
}
