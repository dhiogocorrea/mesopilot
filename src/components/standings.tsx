"use client";

import { useState } from "react";

import { formatNumber } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { rankBy, RANK_PERIODS, type LeaderboardRow, type RankPeriod } from "@/lib/standings";
import { Avatar, PersonName } from "./avatar";
import { TIER_INK } from "./medal";
import { Chevron, Chip, List, Row, RowLink, Section, cx } from "./ui";

/**
 * You and your friends, ranked — this month or all time.
 *
 * The toggle is local rather than a search param: both windows arrive in the
 * same payload, so switching is a re-sort of data already on the device. Routing
 * it through the URL re-fetched the whole page (feed, friends, requests) to
 * change one section, and lost the reader's place doing it — the standings sit
 * mid-screen, and `scroll={false}` did not hold position across the navigation.
 */
export function Standings({ rows }: { rows: LeaderboardRow[] }) {
  const { t, locale } = useI18n();
  // The month is the one still being played for; all time is one tap away.
  const [period, setPeriod] = useState<RankPeriod>("month");

  const ranked = rankBy(rows, period);

  return (
    <Section
      label={t("friends.rank")}
      action={
        <div className="flex gap-1">
          {RANK_PERIODS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setPeriod(value)}
              aria-pressed={value === period}
              className={cx(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors",
                value === period ? "bg-accent-soft text-accent" : "text-ink-3 active:bg-surface",
              )}
            >
              {value === "month" ? t("friends.rankMonth") : t("friends.rankAll")}
            </button>
          ))}
        </div>
      }
    >
      <List>
        {ranked.map((row, index) => {
          const score = (
            <RankScore
              points={row[period].points}
              locale={locale}
              label={
                row[period].sessions === 1
                  ? t("friends.sessionsDoneOne")
                  : t("friends.sessionsDone", { count: row[period].sessions })
              }
            />
          );

          return (
            <Row key={row.userId}>
              {row.you ? (
                <div className="flex items-center gap-3 py-3.5">
                  <RankPosition index={index} />
                  <Avatar name={row.name} username={row.username} size="sm" />
                  <PersonName
                    name={row.name}
                    username={row.username}
                    className="flex-1"
                    tone="accent"
                    badge={<Chip tone="accent">{t("friends.rankYou")}</Chip>}
                  />
                  {score}
                  {/* Your own row is not a link, but the scores still have to
                      line up with the rows that are — so the chevron's width is
                      held open rather than collapsed. */}
                  <span className="size-4 shrink-0" aria-hidden="true" />
                </div>
              ) : (
                <RowLink href={`/friends/${row.username}`}>
                  <RankPosition index={index} />
                  <Avatar name={row.name} username={row.username} size="sm" />
                  <PersonName name={row.name} username={row.username} className="flex-1" />
                  {score}
                  <Chevron />
                </RowLink>
              )}
            </Row>
          );
        })}
      </List>
    </Section>
  );
}

/** Position in the standings. Only the podium is worth a distinct colour. */
function RankPosition({ index }: { index: number }) {
  // The same three metals the medals use, not a second set of them.
  const podium = [TIER_INK.gold, TIER_INK.silver, TIER_INK.bronze];

  return (
    <span
      className={cx(
        "w-4 shrink-0 text-center text-[13px] font-bold tabular-nums",
        podium[index] ?? "text-ink-3",
      )}
    >
      {index + 1}
    </span>
  );
}

/**
 * Points rank; sessions explain the order when nobody has crossed a milestone
 * this month, which is most months.
 */
function RankScore({
  points,
  locale,
  label,
}: {
  points: number;
  locale: Parameters<typeof formatNumber>[1];
  label: string;
}) {
  return (
    <span className="shrink-0 text-right">
      <span className="block text-[15px] font-semibold tabular-nums">
        {formatNumber(points, locale)}
      </span>
      <span className="mt-0.5 block whitespace-nowrap text-[12px] tabular-nums text-ink-3">
        {label}
      </span>
    </span>
  );
}
