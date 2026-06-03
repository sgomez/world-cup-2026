"use client";

import { useActionState } from "react";
import { type ProfileActionState, updateProfile } from "@/app/actions/profile";

interface ProfileFormProps {
  name: string;
  email: string;
  image?: string | null;
}

export function ProfileForm({ name, email, image }: ProfileFormProps) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateProfile,
    null,
  );

  return (
    <form action={action} className="mt-8 space-y-6">
      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          disabled
          className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-slate-500 text-sm cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-slate-600">
          Email cannot be changed — it is your identity.
        </p>
      </div>

      <div>
        <label
          htmlFor="name"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          defaultValue={name}
          required
          className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
        />
      </div>

      <div>
        <label
          htmlFor="image"
          className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
        >
          Profile Image URL
        </label>
        <input
          id="image"
          name="image"
          type="url"
          defaultValue={image ?? ""}
          placeholder="https://example.com/avatar.jpg"
          className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-slate-100 placeholder-slate-500 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-colors"
        />
      </div>

      {state?.error && <p className="text-sm text-rose-400">{state.error}</p>}
      {state?.success && (
        <p className="text-sm text-emerald-400">Profile updated.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-teal-500 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all"
      >
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
