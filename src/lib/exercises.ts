import { ExerciseInfo, PushVariation, PullVariation } from '@/types/emom';

export const PUSH_EXERCISES: ExerciseInfo[] = [
  {
    id: 'regular_pushup',
    name: 'Regular Push-Up',
    category: 'push',
    tier: 1,
    description: 'The foundation. Master this and you can bench 225.',
    requiredRepsToUnlock: 0,
    icon: '💪',
  },
  {
    id: 'diamond_pushup',
    name: 'Diamond Push-Up',
    category: 'push',
    tier: 1,
    description: 'Hands together for tricep emphasis.',
    prerequisiteId: 'regular_pushup',
    requiredRepsToUnlock: 120,
    icon: '💎',
  },
  {
    id: 'wide_pushup',
    name: 'Wide Push-Up',
    category: 'push',
    tier: 1,
    description: 'Wide grip for outer chest activation.',
    prerequisiteId: 'regular_pushup',
    requiredRepsToUnlock: 120,
    icon: '🦅',
  },
  {
    id: 'decline_pushup',
    name: 'Decline Push-Up',
    category: 'push',
    tier: 2,
    description: 'Feet elevated. Targets upper chest and front delts.',
    prerequisiteId: 'regular_pushup',
    requiredRepsToUnlock: 120,
    icon: '📐',
  },
  {
    id: 'dips',
    name: 'Dips',
    category: 'push',
    tier: 2,
    description: 'Parallel bars or sturdy chairs. Heavy chest, tricep, and front delt builder.',
    prerequisiteId: 'regular_pushup',
    requiredRepsToUnlock: 120,
    icon: '🔻',
  },
  {
    id: 'pike_pushup',
    name: 'Pike Push-Up',
    category: 'push',
    tier: 2,
    description: 'Hips high, shoulders loaded. Gateway to handstands.',
    prerequisiteId: 'decline_pushup',
    requiredRepsToUnlock: 120,
    icon: '⛰️',
  },
  {
    id: 'archer_pushup',
    name: 'Archer Push-Up',
    category: 'push',
    tier: 3,
    description: 'One arm takes the load. Serious unilateral strength.',
    prerequisiteId: 'decline_pushup',
    requiredRepsToUnlock: 120,
    icon: '🏹',
  },
  {
    id: 'pseudo_planche_pushup',
    name: 'Pseudo Planche Push-Up',
    category: 'push',
    tier: 3,
    description: 'Hands by your hips. Builds planche foundation.',
    prerequisiteId: 'pike_pushup',
    requiredRepsToUnlock: 120,
    icon: '🔥',
  },
  {
    id: 'wall_handstand_pushup',
    name: 'Wall Handstand Push-Up (Back)',
    category: 'push',
    tier: 4,
    description: 'Back to wall. Full shoulder press with bodyweight.',
    prerequisiteId: 'pike_pushup',
    requiredRepsToUnlock: 120,
    icon: '🧱',
  },
  {
    id: 'stomach_wall_handstand_pushup',
    name: 'Wall Handstand Push-Up (Stomach)',
    category: 'push',
    tier: 4,
    description: 'Stomach to wall. Stricter form, harder balance.',
    prerequisiteId: 'wall_handstand_pushup',
    requiredRepsToUnlock: 120,
    icon: '🏗️',
  },
  {
    id: 'freestanding_handstand_pushup',
    name: 'Freestanding Handstand Push-Up',
    category: 'push',
    tier: 5,
    description: 'The pinnacle of push strength. No wall needed.',
    prerequisiteId: 'stomach_wall_handstand_pushup',
    requiredRepsToUnlock: 120,
    icon: '🤸',
  },
  {
    id: 'planche_pushup',
    name: 'Planche Push-Up',
    category: 'push',
    tier: 5,
    description: 'Legendary. Horizontal push with no ground contact below waist.',
    prerequisiteId: 'pseudo_planche_pushup',
    requiredRepsToUnlock: 120,
    icon: '👑',
  },
];

export const PULL_EXERCISES: ExerciseInfo[] = [
  {
    id: 'chin_up',
    name: 'Chin-Up',
    category: 'pull',
    tier: 1,
    description: 'Supinated grip. Bicep-dominant pull.',
    requiredRepsToUnlock: 0,
    icon: '🤏',
  },
  {
    id: 'neutral_grip_pullup',
    name: 'Neutral Grip Pull-Up',
    category: 'pull',
    tier: 1,
    description: 'Palms facing each other. Joint-friendly.',
    requiredRepsToUnlock: 0,
    icon: '🤝',
  },
  {
    id: 'regular_pullup',
    name: 'Regular Pull-Up',
    category: 'pull',
    tier: 2,
    description: 'Pronated grip. The gold standard of back training.',
    prerequisiteId: 'chin_up',
    requiredRepsToUnlock: 120,
    icon: '💪',
  },
  {
    id: 'wide_grip_pullup',
    name: 'Wide Grip Pull-Up',
    category: 'pull',
    tier: 2,
    description: 'Wide grip for lat width. V-taper builder.',
    prerequisiteId: 'regular_pullup',
    requiredRepsToUnlock: 120,
    icon: '🦇',
  },
  {
    id: 'archer_pullup',
    name: 'Archer Pull-Up',
    category: 'pull',
    tier: 3,
    description: 'One arm pulls, one assists. Unilateral beast mode.',
    prerequisiteId: 'wide_grip_pullup',
    requiredRepsToUnlock: 120,
    icon: '🏹',
  },
  {
    id: 'typewriter_pullup',
    name: 'Typewriter Pull-Up',
    category: 'pull',
    tier: 3,
    description: 'Pull up and slide side to side at the top.',
    prerequisiteId: 'wide_grip_pullup',
    requiredRepsToUnlock: 120,
    icon: '⌨️',
  },
  {
    id: 'muscle_up',
    name: 'Muscle-Up',
    category: 'pull',
    tier: 4,
    description: 'Pull through the bar. Explosive power move.',
    prerequisiteId: 'archer_pullup',
    requiredRepsToUnlock: 120,
    icon: '🚀',
  },
  {
    id: 'front_lever_raise',
    name: 'Front Lever Raise',
    category: 'pull',
    tier: 4,
    description: 'Straight body raise to horizontal. Core + lats.',
    prerequisiteId: 'archer_pullup',
    requiredRepsToUnlock: 120,
    icon: '🏋️',
  },
  {
    id: 'front_lever_pullup',
    name: 'Front Lever Pull-Up',
    category: 'pull',
    tier: 5,
    description: 'Pull-up from a horizontal body position. Elite.',
    prerequisiteId: 'front_lever_raise',
    requiredRepsToUnlock: 120,
    icon: '🏆',
  },
];

export const ALL_EXERCISES: ExerciseInfo[] = [...PUSH_EXERCISES, ...PULL_EXERCISES];

export function getExerciseById(id: string): ExerciseInfo | undefined {
  return ALL_EXERCISES.find(e => e.id === id);
}

export function getDefaultUnlocked(): string[] {
  return ['regular_pushup', 'chin_up', 'neutral_grip_pullup'];
}

/**
 * Walk the prerequisite chain upward from an exercise to its tier-1 root.
 * Returns every ancestor (not including the exercise itself), nearest first.
 * Used by the Challenge feature: clearing a hard move proves you can do every
 * easier move leading up to it, so those get unlocked for rep-logging.
 */
export function getAncestors(id: string): ExerciseInfo[] {
  const chain: ExerciseInfo[] = [];
  let current = getExerciseById(id)?.prerequisiteId;
  while (current) {
    const info = getExerciseById(current);
    if (!info) break;
    chain.push(info);
    current = info.prerequisiteId;
  }
  return chain;
}

/** Exercises that list `id` as their prerequisite (the next tier it unlocks). */
export function getDependents(id: string): ExerciseInfo[] {
  return ALL_EXERCISES.filter(e => e.prerequisiteId === id);
}
