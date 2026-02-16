/**
 * Compass Ritual Sequence — Animation Definitions
 *
 * Pure data module mapping weekly alignment steps to compass spindle positions
 * and animation timing. Used by CompassRitualController to orchestrate the
 * visual heartbeat of each ritual.
 */

// ============================================
// TYPES
// ============================================

export interface RitualStepConfig {
  /** Gold spindle target angle (cardinal direction) */
  goldAngle: number;
  /** Silver spindle default position when entering this step */
  silverAngle: number;
  /** Whether silver spindle should follow individual items (roles, zones, goals) */
  silverFollowsItems: boolean;
  /** Whether the compass should fade out at this step */
  fadeOut: boolean;
}

// ============================================
// STEP SEQUENCE
// ============================================

/** Maps each weekly alignment step to its compass configuration */
export const RITUAL_STEP_SEQUENCE: Record<string, RitualStepConfig> = {
  step_1: { goldAngle: 0,   silverAngle: 0,   silverFollowsItems: false, fadeOut: false }, // North Star (0° North)
  step_2: { goldAngle: 270, silverAngle: 270, silverFollowsItems: true,  fadeOut: false }, // Roles (270° West)
  step_3: { goldAngle: 90,  silverAngle: 90,  silverFollowsItems: true,  fadeOut: false }, // Wellness (90° East)
  step_4: { goldAngle: 180, silverAngle: 180, silverFollowsItems: true,  fadeOut: false }, // Goals (180° South)
  step_5: { goldAngle: 0,   silverAngle: 0,   silverFollowsItems: false, fadeOut: false }, // Alignment Check (sweep)
  step_6: { goldAngle: 0,   silverAngle: 0,   silverFollowsItems: false, fadeOut: true  }, // Tactical Deployment (fade)
};

/** Step keys indexed by step number (0-5) */
export const STEP_KEYS = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'] as const;

/**
 * Step 5 (Alignment Check) sweep sequence.
 * Gold spindle rotates through all 4 cardinal points as power questions are answered.
 * N (North Star) → W (Roles) → E (Wellness) → S (Goals)
 */
export const ALIGNMENT_SWEEP_ANGLES = [0, 270, 90, 180];

// ============================================
// IGNITION ANIMATION CONFIG
// ============================================

/** Configuration for the opening ignition ceremony animation */
export const IGNITION_CONFIG = {
  /** Gold spindle total spin (2 full clockwise rotations) */
  goldSpinDegrees: 720,
  /** Silver spindle total spin (3 counter-clockwise rotations) */
  silverSpinDegrees: -1080,
  /** Duration of the free-spin phase in ms */
  spinDuration: 2000,
  /** Duration of the deceleration phase in ms */
  decelerateDuration: 1000,
  /** Final angle after deceleration (North) */
  finalAngle: 0,
};

// ============================================
// TIMING CONSTANTS
// ============================================

/** Duration for spindle transitions between steps (ms) */
export const TRANSITION_DURATION = 400;

/** Duration for full-screen → corner shrink animation (ms) */
export const SHRINK_DURATION = 600;

/** Duration for Step 6 fade-out (ms) */
export const FADE_DURATION = 500;

/** Delay after ignition before shrink begins (ms) */
export const POST_IGNITION_DELAY = 300;

// ============================================
// SIZE CONSTANTS
// ============================================

/** Compass size during full-screen ignition (px) */
export const FULL_SIZE = 240;

/** Compass size when docked in corner (px) */
export const CORNER_SIZE = 72;

/** Padding from screen edge when docked (px) */
export const CORNER_PADDING = 16;

/** Horizontal offset when docked — aligns with step content padding (px) */
export const CORNER_PADDING_X = 16;

/** Vertical offset when docked — below navigation header, aligns with step header row (px) */
export const CORNER_PADDING_Y = 16;

// ============================================
// HELPERS
// ============================================

/** Get the ritual step config for a given step index (0-5) */
export function getStepConfig(stepIndex: number): RitualStepConfig {
  const key = STEP_KEYS[stepIndex];
  return RITUAL_STEP_SEQUENCE[key] ?? RITUAL_STEP_SEQUENCE.step_1;
}

/**
 * Calculate silver spindle angle for a sub-item within a quadrant.
 * Distributes items evenly across the quadrant range.
 *
 * @param baseAngle - The cardinal direction center (e.g., 270 for West)
 * @param itemIndex - Index of the current item (0-based)
 * @param totalItems - Total number of items
 * @param spread - Total angular spread (default 90° = full quadrant)
 */
export function calculateItemAngle(
  baseAngle: number,
  itemIndex: number,
  totalItems: number,
  spread: number = 90,
): number {
  if (totalItems <= 1) return baseAngle;
  const startAngle = baseAngle - spread / 2;
  const step = spread / (totalItems - 1);
  return ((startAngle + step * itemIndex) % 360 + 360) % 360;
}
