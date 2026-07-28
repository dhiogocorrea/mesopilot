"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n/provider";
import type { DictionaryKey } from "@/lib/i18n";
import { cx } from "./ui";

const ICON_PROPS = {
  width: 21,
  height: 21,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const TABS: { href: string; label: DictionaryKey; icon: ReactNode }[] = [
  {
    href: "/",
    label: "nav.today",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5.5 10v9.5h13V10" />
      </svg>
    ),
  },
  {
    href: "/plan",
    label: "nav.plan",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3v4M16 3v4M3.5 10h17" />
      </svg>
    ),
  },
  {
    href: "/exercises",
    label: "nav.exercises",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M4 9v6M20 9v6M7 6.5v11M17 6.5v11M7 12h10" />
      </svg>
    ),
  },
  {
    href: "/progress",
    label: "nav.progress",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="m7.5 15 3.5-4.5 3 2.5L20 7" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "nav.settings",
    icon: (
      <svg {...ICON_PROPS} aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
      </svg>
    ),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-canvas/90 pt-1.5 backdrop-blur-xl"
      aria-label={t("app.name")}
    >
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((tab) => {
          const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex flex-col items-center gap-1 pb-0.5 pt-1 text-[10px] font-medium tracking-wide transition-colors",
                  active ? "text-accent" : "text-ink-3",
                )}
              >
                {tab.icon}
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
