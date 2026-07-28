"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { DictionaryKey } from "@/lib/i18n";
import { saveFeedback } from "@/server/actions";
import { Button, Segmented } from "../ui";

/**
 * The four autoregulation questions. Answering them is what lets the engine
 * decide next week's volume, so the UI nags for them rather than hiding them
 * behind a menu.
 */

type Question = {
  key: "soreness" | "pump" | "workload" | "jointPain";
  label: DictionaryKey;
  question: DictionaryKey;
  options: DictionaryKey[];
};

const QUESTIONS: Question[] = [
  {
    key: "soreness",
    label: "feedback.soreness",
    question: "feedback.sorenessQ",
    options: [
      "feedback.soreness0",
      "feedback.soreness1",
      "feedback.soreness2",
      "feedback.soreness3",
    ],
  },
  {
    key: "pump",
    label: "feedback.pump",
    question: "feedback.pumpQ",
    options: ["feedback.pump0", "feedback.pump1", "feedback.pump2"],
  },
  {
    key: "workload",
    label: "feedback.workload",
    question: "feedback.workloadQ",
    options: [
      "feedback.workload0",
      "feedback.workload1",
      "feedback.workload2",
      "feedback.workload3",
    ],
  },
  {
    key: "jointPain",
    label: "feedback.jointPain",
    question: "feedback.jointPainQ",
    options: ["feedback.jointPain0", "feedback.jointPain1", "feedback.jointPain2"],
  },
];

export type FeedbackValues = {
  soreness: number | null;
  pump: number | null;
  workload: number | null;
  jointPain: number | null;
};

export function FeedbackForm({
  sessionExerciseId,
  initial,
  onSaved,
}: {
  sessionExerciseId: string;
  initial: FeedbackValues;
  onSaved?: () => void;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<FeedbackValues>(initial);
  const [pending, startTransition] = useTransition();

  const complete = QUESTIONS.every((question) => values[question.key] !== null);

  function submit() {
    if (!complete) return;
    startTransition(async () => {
      await saveFeedback({
        sessionExerciseId,
        soreness: values.soreness!,
        pump: values.pump!,
        workload: values.workload!,
        jointPain: values.jointPain!,
      });
      onSaved?.();
    });
  }

  return (
    <div className="space-y-5 rounded-2xl border border-hairline bg-surface p-4">
      <div>
        <p className="text-headline">{t("feedback.title")}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{t("feedback.subtitle")}</p>
      </div>

      {QUESTIONS.map((question) => (
        <div key={question.key}>
          <p className="text-label mb-2 uppercase text-ink-3">{t(question.question)}</p>
          <Segmented
            value={values[question.key]}
            onChange={(value) => setValues((current) => ({ ...current, [question.key]: value }))}
            columns={1}
            options={question.options.map((option, index) => ({
              value: index,
              label: t(option),
            }))}
          />
        </div>
      ))}

      <Button full disabled={!complete || pending} onClick={submit}>
        {pending ? t("common.loading") : t("feedback.submit")}
      </Button>
    </div>
  );
}
