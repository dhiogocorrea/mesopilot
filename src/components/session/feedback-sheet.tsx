"use client";

import { useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { DictionaryKey } from "@/lib/i18n";
import { saveFeedback } from "@/server/actions";
import { Sheet } from "../sheet";
import { Button, Segmented } from "../ui";

/**
 * The four autoregulation questions, asked once per muscle group.
 *
 * They are about a muscle rather than a movement — "how sore was your chest
 * coming in" has one answer however many chest exercises you did — so this
 * opens after the last exercise of a muscle, not under every one of them.
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

export const NO_FEEDBACK: FeedbackValues = {
  soreness: null,
  pump: null,
  workload: null,
  jointPain: null,
};

export function FeedbackSheet({
  open,
  onClose,
  sessionId,
  muscleGroupId,
  muscleName,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  muscleGroupId: string;
  /** Named in the heading: which muscle these four answers are about. */
  muscleName: string;
  initial: FeedbackValues;
}) {
  const { t } = useI18n();
  const [values, setValues] = useState<FeedbackValues>(initial);
  const [pending, startTransition] = useTransition();

  const complete = QUESTIONS.every((question) => values[question.key] !== null);

  function submit() {
    if (!complete) return;
    startTransition(async () => {
      await saveFeedback({
        sessionId,
        muscleGroupId,
        soreness: values.soreness!,
        pump: values.pump!,
        workload: values.workload!,
        jointPain: values.jointPain!,
      });
      onClose();
    });
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("feedback.titleFor", { muscle: muscleName })}
      subtitle={t("feedback.subtitle")}
    >
      <div className="space-y-5">
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

        {/* Sticky so the answer is one tap away from wherever the athlete has
            scrolled to, rather than at the end of a list of twelve buttons. */}
        <div className="sticky bottom-0 -mx-5 border-t border-hairline bg-surface px-5 pb-1 pt-3">
          <Button full disabled={!complete || pending} onClick={submit}>
            {pending ? t("common.loading") : t("feedback.submit")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
