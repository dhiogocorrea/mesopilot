import { TrackPicker, type BlockOption, type TrackOption } from "@/components/track-picker";
import { ScreenHeader } from "@/components/ui";
import { createTranslator, localized, localizedDescription, localizedLabel } from "@/lib/i18n";
import { projectMinuteRange } from "@/lib/progression/project";
import { programOrigin, type Experience, type Goal } from "@/lib/types";
import { listTemplates, type TemplateWithDays } from "@/server/mesocycle";
import { listTracks } from "@/server/track";
import { requireProfile } from "@/server/user";
import type { Locale } from "@/lib/types";

export default async function NewBlockPage() {
  const { userId, locale, preferences } = await requireProfile();
  const t = createTranslator(locale);
  const [templates, tracks] = await Promise.all([listTemplates(userId), listTracks(userId)]);

  const blocks = new Map(templates.map((template) => [template.id, toBlock(template, locale)]));

  // Every entry on the picker is a track: a stored sequence, or a program that
  // belongs to none, presented as a track of one.
  const sequences: TrackOption[] = tracks.flatMap((track) => {
    const members = track.entries
      .map((entry) => blocks.get(entry.templateId))
      .filter((block): block is BlockOption => block !== undefined);

    // A track whose programs were all deleted has nothing left to run.
    if (members.length === 0) return [];

    const first = templates.find((template) => template.id === members[0]!.templateId)!;

    return [
      toTrack({
        id: track.id,
        kind: "track",
        name: localized(track, locale),
        description: localizedDescription(track, locale),
        origin: programOrigin(track),
        level: first.level as Experience,
        goal: first.goal as Goal,
        blocks: members,
      }),
    ];
  });

  // A block that is a step of something bigger is not an offer on its own —
  // "PBP · 5-WEEK NOVELTY PHASE" means nothing outside the sequence it was
  // written for. Listing it twice also put the same training in the picker
  // under two names.
  const claimed = new Set(tracks.flatMap((track) => track.entries.map((e) => e.templateId)));

  const singles: TrackOption[] = templates
    .filter((template) => !claimed.has(template.id))
    .map((template) =>
      toTrack({
        id: template.id,
        kind: "block",
        name: localized(template, locale),
        description: localizedDescription(template, locale),
        origin: programOrigin(template),
        level: template.level as Experience,
        goal: template.goal as Goal,
        blocks: [blocks.get(template.id)!],
      }),
    );

  return (
    <>
      <ScreenHeader title={t("track.chooseTitle")} meta={t("track.chooseBody")} />
      <TrackPicker tracks={[...sequences, ...singles]} preferences={preferences} />
    </>
  );
}

function toBlock(template: TemplateWithDays, locale: Locale): BlockOption {
  return {
    templateId: template.id,
    name: localized(template, locale),
    daysPerWeek: template.daysPerWeek,
    weeks: template.weeks,
    estimatedMinutes: template.estimatedMinutes,
    // Projected here rather than stored: `estimatedMinutes` is a column written
    // at seed time from the starting sets, and the number that decides whether
    // a program fits is the one it grows into. Computed from the same slots the
    // picker already loaded, so it costs no extra read and cannot go stale.
    peakMinutes: projectMinuteRange(
      template.days.map((day) =>
        day.slots.map((slot) => ({
          muscleGroupId: slot.muscleGroupId,
          sets: slot.startingSets,
          restSec: slot.restSec,
          sfr: slot.exercise.sfr,
        })),
      ),
      template.weeks,
    ).peak,
    // Stock blocks are shipped with the app, so they are copied rather than
    // changed in place; anything the athlete owns is edited directly.
    editable: template.isCustom,
    days: template.days.map((day) => ({
      label: localizedLabel(day, locale),
      exercises: day.slots.map((slot) => ({
        name: localized(slot.exercise, locale),
        sets: slot.startingSets,
        repMin: slot.repMin,
        repMax: slot.repMax,
      })),
    })),
  };
}

/**
 * Matching uses the first block — the one you would start today — while the
 * summary line shows the spread across all of them, so a track that gets
 * harder later says so without being filtered away for it.
 */
function toTrack(
  track: Omit<
    TrackOption,
    | "daysPerWeek"
    | "estimatedMinutes"
    | "peakMinutes"
    | "minDaysPerWeek"
    | "maxDaysPerWeek"
    | "minEstimatedMinutes"
    | "maxEstimatedMinutes"
    | "totalWeeks"
  >,
): TrackOption {
  const days = track.blocks.map((block) => block.daysPerWeek);
  // Opening length of the shortest block through to the peak of the longest —
  // the honest span of what the athlete is signing up for, rather than the
  // span of week-one figures, which every block leaves behind by week three.
  const opening = track.blocks.map((block) => block.estimatedMinutes);
  const peaks = track.blocks.map((block) => block.peakMinutes);
  const first = track.blocks[0]!;

  return {
    ...track,
    daysPerWeek: first.daysPerWeek,
    estimatedMinutes: first.estimatedMinutes,
    peakMinutes: first.peakMinutes,
    minDaysPerWeek: Math.min(...days),
    maxDaysPerWeek: Math.max(...days),
    minEstimatedMinutes: Math.min(...opening),
    maxEstimatedMinutes: Math.max(...peaks),
    totalWeeks: track.blocks.reduce((total, block) => total + block.weeks, 0),
  };
}
