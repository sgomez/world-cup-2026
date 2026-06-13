"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type ProfileActionState, updateProfile } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";

interface ProfileFormProps {
  name: string;
  email: string;
  image?: string | null;
}

export function ProfileForm({ name, email, image }: ProfileFormProps) {
  const t = useTranslations("profile");
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={action} className="mt-8 space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
        >
          {t("emailLabel")}
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="mt-2 block w-full rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-muted-foreground text-body-md cursor-not-allowed opacity-60 dark:bg-charcoal"
        />
        <p className="mt-1 text-caption-sm text-muted-foreground">
          {t("emailNote")}
        </p>
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
        >
          {t("nameLabel")}
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="mt-2 block w-full rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
      </div>

      <div>
        <label
          htmlFor="image"
          className="block text-caption-sm uppercase tracking-wider text-muted-foreground"
        >
          {t("imageLabel")}
        </label>
        <input
          id="image"
          name="image"
          type="url"
          defaultValue={image ?? ""}
          placeholder="https://example.com/avatar.jpg"
          className="mt-2 block w-full rounded-md border border-hairline bg-soft-cloud px-4 py-3 text-foreground placeholder:text-muted-foreground text-body-md focus:border-ink focus:bg-canvas outline-none transition-colors dark:bg-charcoal dark:focus:bg-ink dark:focus:border-canvas"
        />
      </div>

      {state?.error && (
        <p className="text-body-strong text-sale">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-body-strong text-success">{t("profileUpdated")}</p>
      )}

      <Button type="submit" loading={pending} className="w-full">
        {t("saveChanges")}
      </Button>
    </form>
  );
}
