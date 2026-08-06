import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { currentAuthUser } from "./auth";
import type { TrainingPreferences } from "@/lib/program-match";
import {
  isLocale,
  type CaloricState,
  type Experience,
  type Goal,
  type Locale,
  type WeightUnit,
} from "@/lib/types";

/**
 * Every query hangs off the signed-in user. This file is where a request turns
 * into a `userId`; everything downstream already takes one as an argument, so
 * it is the only place that knows sessions exist.
 */

export type UserContext = {
  userId: string;
  name: string;
  username: string;
  locale: Locale;
  unit: WeightUnit;
  /** IANA zone, or null until a browser has reported one. Decides *when* a
   *  scheduled reminder is allowed to arrive, not what it says. */
  timezone: string | null;
  hasProfile: boolean;
  experience: Experience;
  /** What the athlete said they can commit to. Drives program matching. */
  preferences: TrainingPreferences;
  recovery: {
    sleepQuality: number;
    stressLevel: number;
    nutritionQuality: number;
    caloricState: CaloricState;
  };
};

/**
 * The signed-in user, or null when nobody is. `cache` dedupes it across a
 * single render pass, so every server component on a page shares one query
 * instead of each issuing its own.
 */
export const getOptionalUserContext = cache(async (): Promise<UserContext | null> => {
  // The account arrives with the session it was resolved from — one query for
  // the pair rather than one each. See `currentAuthUser`.
  const user = await currentAuthUser();
  if (!user) return null;

  const profile = user.profile;

  return {
    userId: user.id,
    name: user.name,
    username: user.username,
    locale: isLocale(user.locale) ? user.locale : "en",
    unit: user.unit === "lb" ? "lb" : "kg",
    timezone: user.timezone,
    hasProfile: profile !== null,
    experience: (profile?.experience as Experience) ?? "intermediate",
    preferences: {
      daysPerWeek: profile?.daysPerWeek ?? 4,
      sessionMinutes: profile?.sessionMinutes ?? 60,
      experience: (profile?.experience as Experience) ?? "intermediate",
      goal: (profile?.primaryGoal as Goal) ?? "hypertrophy",
    },
    recovery: {
      sleepQuality: profile?.sleepQuality ?? 3,
      stressLevel: profile?.stressLevel ?? 3,
      nutritionQuality: profile?.nutritionQuality ?? 3,
      caloricState: (profile?.caloricState as CaloricState) ?? "maintenance",
    },
  };
});

/**
 * The signed-in user, or a redirect to the login screen. Everything that reads
 * or writes training data goes through this — a page or action that calls it
 * cannot accidentally run without a user.
 */
export async function getUserContext(): Promise<UserContext> {
  const context = await getOptionalUserContext();
  if (!context) redirect("/login");
  return context;
}

/**
 * Everything downstream — program matching, the progression engine's recovery
 * throttle, the AI coach's context — is built on the anamnesis, so the app has
 * nothing meaningful to show until it exists. Screens call this instead of
 * checking `hasProfile` themselves.
 */
export async function requireProfile(): Promise<UserContext> {
  const context = await getUserContext();
  if (!context.hasProfile) redirect("/onboarding");
  return context;
}

/**
 * Volume landmarks for every muscle, with the user's own calibration applied
 * where one exists. Returned keyed by muscleGroupId for the engine.
 */
export const getLandmarks = cache(
  async (userId: string): Promise<Map<string, { mev: number; mav: number; mrv: number }>> => {
    const [muscles, overrides] = await Promise.all([
      db.muscleGroup.findMany(),
      db.userMuscleLandmark.findMany({ where: { userId } }),
    ]);

    const byMuscle = new Map(overrides.map((row) => [row.muscleGroupId, row]));

    return new Map(
      muscles.map((muscle) => {
        const override = byMuscle.get(muscle.id);
        return [
          muscle.id,
          {
            mev: override?.mev ?? muscle.mev,
            mav: override?.mav ?? muscle.mav,
            mrv: override?.mrv ?? muscle.mrv,
          },
        ];
      }),
    );
  },
);
