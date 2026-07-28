import { AnamnesisForm, type AnamnesisValues } from "@/components/anamnesis-form";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/json";
import { fromKg } from "@/lib/units";
import { EQUIPMENT, type CaloricState, type Equipment, type Experience, type Goal } from "@/lib/types";
import { getUserContext } from "@/server/user";

/**
 * Doubles as first-run onboarding and as the editable health profile reached
 * from Settings. The distinction matters: on a first run there is nowhere to go
 * back to, and on an edit the form must arrive already filled — otherwise
 * saving would quietly overwrite everything the athlete did not retype.
 */
export default async function AnamnesisPage() {
  const { userId, name, unit, hasProfile } = await getUserContext();
  const profile = hasProfile
    ? await db.profile.findUnique({ where: { userId } })
    : null;

  const initial: AnamnesisValues = {
    name,
    sex: (profile?.sex as AnamnesisValues["sex"]) ?? null,
    heightCm: profile?.heightCm ? String(Math.round(profile.heightCm)) : "",
    // Stored in kg; the form works in whatever unit the athlete reads.
    bodyweight: profile?.bodyweightKg
      ? String(Math.round(fromKg(profile.bodyweightKg, unit) * 10) / 10)
      : "",
    experience: (profile?.experience as Experience) ?? "intermediate",
    primaryGoal: (profile?.primaryGoal as Goal) ?? "hypertrophy",
    daysPerWeek: profile?.daysPerWeek ?? 4,
    sessionMinutes: profile?.sessionMinutes ?? 60,
    sleepQuality: profile?.sleepQuality ?? 3,
    stressLevel: profile?.stressLevel ?? 3,
    nutritionQuality: profile?.nutritionQuality ?? 3,
    caloricState: (profile?.caloricState as CaloricState) ?? "maintenance",
    injuries: parseJsonArray<string>(profile?.injuries).join(", "),
    equipment: hasProfile
      ? parseJsonArray<Equipment>(profile?.equipment)
      : [...EQUIPMENT],
  };

  return <AnamnesisForm initial={initial} editing={hasProfile} />;
}
