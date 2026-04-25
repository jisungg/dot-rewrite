"use client";

import { redirect } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { MutableRefObject } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, Monitor, Moon, Sun, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

import { useTier } from "@/lib/use-tier";

export type SettingsApi = {
  dirty: boolean;
  save: () => Promise<void>;
  discard: () => void;
};

import type {
  Space,
  Profile,
  UserPreferences,
  ResponseStyle,
  ThemePreference,
} from "@/data/types";
import { DEFAULT_PREFERENCES } from "@/data/types";
import {
  fetchProfileByEmail,
  updateProfileName,
  updateProfilePreferences,
} from "@/utils/supabase/queries";
import { useTheme } from "@/components/theme-provider";
import {
  SAMPLE_PROMPT,
  SAMPLE_RESPONSES,
  RESPONSE_STYLE_META,
} from "@/lib/ai-preferences";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: {
  id: ThemePreference;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

export default function SettingsPage({
  user,
  allSpaces: _allSpaces,
  apiRef,
}: {
  user: User;
  allSpaces: Space[];
  apiRef?: MutableRefObject<SettingsApi | null>;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [draftPrefs, setDraftPrefs] = useState<UserPreferences>(
    DEFAULT_PREFERENCES,
  );

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const run = async () => {
      if (!user || !user.email) redirect("/sign-in");
      try {
        const fetched = await fetchProfileByEmail(user.email);
        setProfile(fetched);
        if (fetched) {
          setFirstName(fetched.first_name);
          setLastName(fetched.last_name ?? "");
          setDraftPrefs(fetched.preferences);
          setTheme(fetched.preferences.theme);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoadingProfile(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const nameDirty = useMemo(() => {
    if (!profile) return false;
    return (
      firstName.trim() !== profile.first_name ||
      lastName.trim() !== (profile.last_name ?? "")
    );
  }, [firstName, lastName, profile]);

  const prefsDirty = useMemo(() => {
    if (!profile) return false;
    const p = profile.preferences;
    return (
      p.theme !== draftPrefs.theme ||
      p.response_style !== draftPrefs.response_style ||
      p.auto_summaries !== draftPrefs.auto_summaries
    );
  }, [profile, draftPrefs]);

  const dirty = nameDirty || prefsDirty;

  const patchDraft = (patch: Partial<UserPreferences>) => {
    setDraftPrefs((prev) => ({ ...prev, ...patch }));
    if (savedAt) setSavedAt(null);
    if (saveError) setSaveError(null);
  };

  const handleThemeChange = (next: ThemePreference) => {
    patchDraft({ theme: next });
    setTheme(next);
  };

  const handleSaveAll = async () => {
    if (!profile || !dirty) return;
    setSaving(true);
    setSaveError(null);
    try {
      let nextProfile = profile;
      if (nameDirty) {
        nextProfile = await updateProfileName(firstName, lastName);
      }
      if (prefsDirty) {
        const patch: Partial<UserPreferences> = {};
        if (draftPrefs.theme !== profile.preferences.theme) {
          patch.theme = draftPrefs.theme;
        }
        if (draftPrefs.response_style !== profile.preferences.response_style) {
          patch.response_style = draftPrefs.response_style;
        }
        if (draftPrefs.auto_summaries !== profile.preferences.auto_summaries) {
          patch.auto_summaries = draftPrefs.auto_summaries;
        }
        nextProfile = await updateProfilePreferences(patch);
      }
      setProfile(nextProfile);
      setFirstName(nextProfile.first_name);
      setLastName(nextProfile.last_name ?? "");
      setDraftPrefs(nextProfile.preferences);
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (!profile) return;
    setFirstName(profile.first_name);
    setLastName(profile.last_name ?? "");
    setDraftPrefs(profile.preferences);
    setTheme(profile.preferences.theme);
    setSaveError(null);
    setSavedAt(null);
  };

  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = {
      dirty,
      save: handleSaveAll,
      discard: handleDiscard,
    };
    return () => {
      if (apiRef) apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, firstName, lastName, draftPrefs, profile]);

  if (loadingProfile) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-gray-500 dark:text-zinc-400 text-sm">
          Loading settings...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        <p className="text-gray-600 dark:text-zinc-400">Profile unavailable.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl px-2 py-2 space-y-10 pb-8">
          <section className="space-y-4">
            <SectionHeader
              title="Profile"
              description="Your account identity across .note."
            />

            <Field label="First name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  if (savedAt) setSavedAt(null);
                }}
                placeholder="First name"
                className="w-full rounded-md border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-gray-800 dark:text-zinc-100 outline-none focus:border-gray-400 dark:focus:border-zinc-500 transition-colors"
              />
            </Field>

            <Field label="Last name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  if (savedAt) setSavedAt(null);
                }}
                placeholder="Last name"
                className="w-full rounded-md border border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-sm text-gray-800 dark:text-zinc-100 outline-none focus:border-gray-400 dark:focus:border-zinc-500 transition-colors"
              />
            </Field>

            <Field
              label="Email"
              hint="Your email is tied to your account and cannot be changed here."
            >
              <div className="w-full rounded-md border border-gray-100/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-3 py-1.5 text-sm text-gray-500 dark:text-zinc-500 cursor-not-allowed select-all">
                {profile.email}
              </div>
            </Field>
          </section>

          <Divider />

          <BillingSection />

          <Divider />

          <section className="space-y-4">
            <SectionHeader
              title="Theme"
              description={`Currently resolved as ${resolvedTheme}.`}
            />
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = draftPrefs.theme === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleThemeChange(option.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-md border px-3 py-4 text-xs transition-colors",
                      active
                        ? "border-gray-400 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                        : "border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <Divider />

          <section className="space-y-4">
            <SectionHeader
              title="AI preferences"
              description="Shape how Dot responds to you."
            />

            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
                Response style
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RESPONSE_STYLE_META.map((style) => {
                  const active = draftPrefs.response_style === style.id;
                  return (
                    <button
                      key={style.id}
                      onClick={() => patchDraft({ response_style: style.id })}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left text-xs transition-colors",
                        active
                          ? "border-gray-400 dark:border-zinc-400 bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100"
                          : "border-gray-100/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800",
                      )}
                    >
                      <span className="font-medium">{style.label}</span>
                      <span className="text-[11px] text-gray-500 dark:text-zinc-500">
                        {style.blurb}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-md border border-gray-100/80 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                  Sample prompt
                </div>
                <div className="text-xs text-gray-700 dark:text-zinc-300 italic">
                  &ldquo;{SAMPLE_PROMPT}&rdquo;
                </div>
                <div className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 pt-1">
                  {labelFor(draftPrefs.response_style)} response
                </div>
                <div className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed">
                  {SAMPLE_RESPONSES[draftPrefs.response_style]}
                </div>
              </div>
            </div>

            <ToggleRow
              label="Auto-generated summaries"
              description="Let Dot generate summaries for new notes automatically."
              checked={draftPrefs.auto_summaries}
              onChange={(value) => patchDraft({ auto_summaries: value })}
            />
          </section>
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-100/80 dark:border-zinc-800">
        <div className="mx-auto max-w-2xl px-2 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-gray-500 dark:text-zinc-500">
            {saveError ? (
              <span className="text-red-500">{saveError}</span>
            ) : savedAt && !dirty ? (
              <span className="flex items-center gap-1 text-green-500">
                <Check className="h-3 w-3" /> All changes saved
              </span>
            ) : dirty ? (
              "You have unsaved changes."
            ) : (
              "No changes."
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={!dirty || saving}
              className="text-xs rounded-md px-3 py-1.5 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAll}
              disabled={!dirty || saving}
              className="text-xs rounded-md border border-gray-100/80 dark:border-zinc-700 px-3 py-1.5 text-gray-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function labelFor(style: ResponseStyle): string {
  return RESPONSE_STYLE_META.find((s) => s.id === style)?.label ?? style;
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-sm font-medium text-gray-900 dark:text-zinc-100">
        {title}
      </h2>
      {description && (
        <p className="text-xs text-gray-500 dark:text-zinc-500">
          {description}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] text-gray-500 dark:text-zinc-500">{hint}</p>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-gray-100 dark:bg-zinc-800" />;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <div className="text-xs font-medium text-gray-700 dark:text-zinc-300">
          {label}
        </div>
        {description && (
          <div className="text-[11px] text-gray-500 dark:text-zinc-500">
            {description}
          </div>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 dark:focus-visible:ring-zinc-500",
          checked
            ? "bg-gray-800 dark:bg-zinc-200"
            : "bg-gray-200 dark:bg-zinc-700",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm ring-0 transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

function BillingSection() {
  const { tier: _tier, loading, isPlus } = useTier();
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  const openPortal = async () => {
    setPortalError(null);
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (!res.ok) {
        const txt = await res.text().catch(() => `${res.status}`);
        throw new Error(txt || `request failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("no_portal_url");
      window.location.href = url;
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : String(err));
      setPortalLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <SectionHeader
        title="Billing"
        description="Your plan and subscription management."
      />
      <div className="rounded-lg border border-gray-100/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
            ) : isPlus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-semibold">
                <Sparkles className="h-3 w-3" /> Plus Student
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-2 py-0.5 text-[11px] font-semibold">
                Free
              </span>
            )}
            <span className="text-[12px] text-zinc-500 dark:text-zinc-400 truncate">
              {isPlus
                ? "Unlimited everything · cancel anytime."
                : "Daily caps apply. Plus removes them and unlocks the full Nexus."}
            </span>
          </div>
          {portalError && (
            <div className="mt-2 text-[11px] text-red-500 dark:text-red-400">
              {portalError}
            </div>
          )}
        </div>
        {isPlus ? (
          <button
            type="button"
            onClick={() => void openPortal()}
            disabled={portalLoading}
            className="h-8 px-3 rounded-md text-[12px] font-medium border border-gray-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5"
          >
            {portalLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ExternalLink className="h-3 w-3" />
            )}
            Manage
          </button>
        ) : (
          <Link
            href="/pricing"
            className="h-8 px-3 rounded-md text-[12px] font-medium bg-blue-600 hover:bg-blue-500 text-white inline-flex items-center gap-1.5"
          >
            <Sparkles className="h-3 w-3" />
            Upgrade
          </Link>
        )}
      </div>
    </section>
  );
}
