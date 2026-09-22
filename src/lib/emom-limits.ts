/** Push/pull training limits; leg workouts use their own logging rules. */
export const NUM_SETS = 10;
export const MAX_REPS_PER_SET = 30;
export const TARGET_TOTAL_REPS = NUM_SETS * MAX_REPS_PER_SET;

/** Existing achievement and XP thresholds are separate from the logging limit. */
export const MILESTONE_REPS_PER_SET = 12;
export const MILESTONE_TOTAL_REPS = NUM_SETS * MILESTONE_REPS_PER_SET;
