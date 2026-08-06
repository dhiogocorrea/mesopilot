/**
 * Domain vocabulary. These are String columns in the schema (sqlite has no
 * enums) so this file is the single source of truth for the allowed values.
 */

export const LOCALES = ["en", "pt"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Cookie holding the language for a browser we have not identified yet. */
export const LOCALE_COOKIE = "m505_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const GOALS = ["hypertrophy", "strength", "fatloss", "general"] as const;
export type Goal = (typeof GOALS)[number];

export const CALORIC_STATES = ["deficit", "maintenance", "surplus"] as const;
export type CaloricState = (typeof CALORIC_STATES)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "smith",
  "bodyweight",
  "band",
  "kettlebell",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const MOVEMENT_TYPES = ["compound", "isolation"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const SESSION_STATUSES = ["planned", "in_progress", "completed", "skipped"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const MESOCYCLE_STATUSES = ["active", "completed", "abandoned"] as const;
export type MesocycleStatus = (typeof MESOCYCLE_STATUSES)[number];

export const DECISION_SOURCES = ["rule", "ai", "manual"] as const;
export type DecisionSource = (typeof DECISION_SOURCES)[number];

/**
 * The kinds of notification the app can send.
 *
 * Split by who asked for it. A **reactive** kind is a direct consequence of
 * something the recipient is a party to — someone sent them a request, someone
 * answered theirs — and arrives because they were already involved. A
 * **scheduled** kind is the app deciding on its own that now is a good time to
 * say something, which is a different bargain and the reason only these can be
 * muted individually (`NotificationOptOut`). Turning notifications off entirely
 * remains the way to stop the rest.
 */
export const REACTIVE_NOTIFICATION_KINDS = [
  "friend.request",
  "friend.accepted",
  "test.ping",
] as const;

export const SCHEDULED_NOTIFICATION_KINDS = [
  /** A workout was started and left open. */
  "session.abandoned",
  /** A training week is about to pass with nothing in it. */
  "streak.atRisk",
  /** No active block, and nothing logged for a while. */
  "training.lapsed",
] as const;

export const NOTIFICATION_KINDS = [
  ...REACTIVE_NOTIFICATION_KINDS,
  ...SCHEDULED_NOTIFICATION_KINDS,
] as const;

export type ReactiveNotificationKind = (typeof REACTIVE_NOTIFICATION_KINDS)[number];
export type ScheduledNotificationKind = (typeof SCHEDULED_NOTIFICATION_KINDS)[number];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export function isScheduledKind(value: string): value is ScheduledNotificationKind {
  return (SCHEDULED_NOTIFICATION_KINDS as readonly string[]).includes(value);
}

/**
 * Whether an exercise in a logged session is part of the block's plan. The
 * plan is the sessions themselves — next week is written from this week — so
 * "extra" and "skipped" are how an edit stays confined to one day.
 */
export const ENTRY_PLANS = ["planned", "extra", "skipped"] as const;
export type EntryPlan = (typeof ENTRY_PLANS)[number];

/** Does an edit end with today, or does the plan change with it? */
export const EDIT_SCOPES = ["session", "forward"] as const;
export type EditScope = (typeof EDIT_SCOPES)[number];

/**
 * Where a program or track came from. "custom" is the only one the athlete
 * authored — an imported program is theirs to edit but was written by someone
 * else, so the UI must not credit it to them.
 */
export const PROGRAM_ORIGINS = ["stock", "custom", "import"] as const;
export type ProgramOrigin = (typeof PROGRAM_ORIGINS)[number];

export function programOrigin(record: { isCustom: boolean; source: string | null }): ProgramOrigin {
  if (!record.isCustom) return "stock";
  return record.source === "import" ? "import" : "custom";
}

// -------------------------------------------------------------- feedback
//
// The four autoregulation questions, mirroring the RP model. Numeric ordering
// matters: the progression engine treats these as ordinal scales.

/** How sore was the muscle from last time, asked before working it again. */
export const SORENESS = {
  NEVER_SORE: 0,
  HEALED_A_WHILE_AGO: 1,
  HEALED_JUST_ON_TIME: 2,
  STILL_SORE: 3,
} as const;
export type Soreness = (typeof SORENESS)[keyof typeof SORENESS];

/** Quality of the pump at the end of the exercise. */
export const PUMP = {
  LOW: 0,
  MODERATE: 1,
  AMAZING: 2,
} as const;
export type Pump = (typeof PUMP)[keyof typeof PUMP];

/** How hard the work felt relative to what the muscle can take. */
export const WORKLOAD = {
  EASY: 0,
  PRETTY_GOOD: 1,
  PUSHED_LIMITS: 2,
  TOO_MUCH: 3,
} as const;
export type Workload = (typeof WORKLOAD)[keyof typeof WORKLOAD];

/** Joint / connective tissue discomfort — a safety brake, not a stimulus signal. */
export const JOINT_PAIN = {
  NONE: 0,
  SOME: 1,
  A_LOT: 2,
} as const;
export type JointPain = (typeof JOINT_PAIN)[keyof typeof JOINT_PAIN];

export type ExerciseFeedback = {
  soreness: Soreness;
  pump: Pump;
  workload: Workload;
  jointPain: JointPain;
};

export type PartialFeedback = Partial<ExerciseFeedback>;
