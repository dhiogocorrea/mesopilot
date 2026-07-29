"use client";

import { useActionState, useState, useTransition } from "react";

import { useI18n } from "@/lib/i18n/provider";
import {
  cancelFriendRequest,
  removeFriend,
  respondToFriendRequest,
  sendFriendRequest,
  type FriendResult,
} from "@/server/friend-actions";
import { Button, Input, cx } from "./ui";

/** Add someone by exact username. There is no directory to browse, by design. */
export function AddFriendForm() {
  const { t } = useI18n();
  const [result, submit, pending] = useActionState<FriendResult, FormData>(
    sendFriendRequest,
    undefined,
  );

  return (
    <form action={submit} className="space-y-3">
      <p className="text-[13px] leading-relaxed text-ink-2">{t("friends.addHint")}</p>
      <div className="flex gap-2.5">
        <Input
          name="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("friends.usernamePlaceholder")}
          aria-label={t("friends.usernamePlaceholder")}
          required
        />
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? t("common.loading") : t("friends.send")}
        </Button>
      </div>

      {result && "error" in result && (
        <p className="text-sm text-danger">{t(result.error)}</p>
      )}
      {result && "ok" in result && <p className="text-sm text-accent">{t("friends.sent")}</p>}
    </form>
  );
}

export function RequestActions({ friendshipId }: { friendshipId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 gap-2">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(() => respondToFriendRequest({ friendshipId, accept: true }))
        }
      >
        {t("friends.accept")}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(() => respondToFriendRequest({ friendshipId, accept: false }))
        }
      >
        {t("friends.decline")}
      </Button>
    </div>
  );
}

export function WithdrawButton({ friendshipId }: { friendshipId: string }) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      className="shrink-0"
      onClick={() => startTransition(() => cancelFriendRequest(friendshipId))}
    >
      {t("friends.cancel")}
    </Button>
  );
}

/** Ending a friendship is mutual and silent, so it takes a second tap. */
export function RemoveFriendButton({
  friendshipId,
  name,
}: {
  friendshipId: string;
  name: string;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 text-[13px] text-ink-3 underline decoration-hairline-strong underline-offset-4"
      >
        {t("friends.remove")}
      </button>
    );
  }

  return (
    <div className={cx("shrink-0 space-y-2 text-right", pending && "opacity-60")}>
      <p className="max-w-[24ch] text-[12px] leading-snug text-ink-2">
        {t("friends.removeConfirm", { name })}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="danger"
          disabled={pending}
          onClick={() => startTransition(() => removeFriend(friendshipId))}
        >
          {t("common.confirm")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </Button>
      </div>
    </div>
  );
}
