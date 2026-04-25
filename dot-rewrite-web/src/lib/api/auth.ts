import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { createClient } from "@/utils/supabase/server";
import { HttpError } from "@/lib/api/validate";

export type AuthedContext = {
  supabase: SupabaseClient;
  user: User;
};

export async function requireUser(): Promise<AuthedContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new HttpError(401, "unauthenticated");
  }
  return { supabase, user };
}

/** Verify the calling user owns the given space. Returns the space row. */
export async function requireSpaceOwnership(
  ctx: AuthedContext,
  spaceId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await ctx.supabase
    .from("spaces")
    .select("id, name")
    .eq("id", spaceId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) {
    throw new HttpError(500, "space_read_failed", error.message);
  }
  if (!data) {
    throw new HttpError(404, "space_not_found");
  }
  return data as { id: string; name: string };
}

/** Verify the calling user owns the given note. Returns the row. */
export async function requireNoteOwnership(
  ctx: AuthedContext,
  noteId: string,
  columns = "id, title, content",
): Promise<Record<string, unknown>> {
  const { data, error } = await ctx.supabase
    .from("notes")
    .select(columns)
    .eq("id", noteId)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  if (error) {
    throw new HttpError(500, "note_read_failed", error.message);
  }
  if (!data) {
    throw new HttpError(404, "note_not_found");
  }
  return data as unknown as Record<string, unknown>;
}
