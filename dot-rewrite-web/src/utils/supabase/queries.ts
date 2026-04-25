"use server";

import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  type Space,
  type Note,
  type Message,
  type Profile,
  type UserPreferences,
  type SimEdge,
  type SpaceRelationships,
  type TopicClusterRow,
  type TopicSubclusterRow,
  type ConfusionPairRow,
  type ConceptHubRow,
  type NoteDiagnosticRow,
  type StudyStateEdgeRow,
  type SemanticEdgeRow,
  type SemanticClusterRow,
  type TopicHierarchyPathRow,
  type UngroupedNoteRow,
  DEFAULT_PREFERENCES,
} from "@/data/types";
import { revalidatePath } from "next/cache";

function normalizePreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
  const r = raw as Record<string, unknown>;
  const t = r["theme"];
  const s = r["response_style"];
  const a = r["auto_summaries"];
  return {
    theme:
      t === "light" || t === "dark" || t === "system"
        ? t
        : DEFAULT_PREFERENCES.theme,
    response_style:
      s === "concise" || s === "balanced" || s === "explanatory"
        ? s
        : DEFAULT_PREFERENCES.response_style,
    auto_summaries:
      typeof a === "boolean" ? a : DEFAULT_PREFERENCES.auto_summaries,
  };
}

function hydrateProfile(raw: Record<string, unknown>): Profile {
  return {
    ...(raw as unknown as Profile),
    preferences: normalizePreferences(raw["preferences"]),
  };
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unable to retrieve user session.");
  }
  return { supabase, user };
}

export async function getSpaces(user_id: string): Promise<Space[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .select("*")
    .eq("user_id", user_id);

  if (error) {
    console.error("getSpaces error:", error.message);
    return [];
  }
  return (data ?? []) as Space[];
}

export async function addSpace(spaceData: {
  name: string;
  code: string;
  color: string;
  color_light: string;
}): Promise<Space> {
  const { supabase, user } = await requireUser();

  if (!spaceData.name || !spaceData.code) {
    throw new Error("Space name and code are required.");
  }
  if (spaceData.code.length > 15) {
    throw new Error("The code for your space must be under 15 characters.");
  }
  if (spaceData.name.length > 25) {
    throw new Error("The name for your space must be under 25 characters.");
  }

  const { data, error } = await supabase
    .from("spaces")
    .insert([
      {
        name: spaceData.name,
        code: spaceData.code.toLocaleLowerCase(),
        color: spaceData.color,
        color_light: spaceData.color_light,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A space with this code already exists.");
    }
    console.error("addSpace error:", error);
    throw new Error("Something went wrong adding this space. Try again.");
  }

  revalidatePath("/dashboard");
  return data as Space;
}

export async function updateSpace(
  spaceId: string,
  patch: {
    name?: string;
    code?: string;
    color?: string;
    color_light?: string;
  },
): Promise<Space> {
  const { supabase, user } = await requireUser();

  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new Error("Space name cannot be empty.");
    if (patch.name.length > 25)
      throw new Error("The name for your space must be under 25 characters.");
  }
  if (patch.code !== undefined) {
    if (!patch.code.trim()) throw new Error("Space code cannot be empty.");
    if (patch.code.length > 15)
      throw new Error("The code for your space must be under 15 characters.");
  }

  const { data, error } = await supabase
    .from("spaces")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.code !== undefined
        ? { code: patch.code.toLocaleLowerCase() }
        : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.color_light !== undefined
        ? { color_light: patch.color_light }
        : {}),
    })
    .eq("id", spaceId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A space with this code already exists.");
    }
    console.error("updateSpace error:", error);
    throw new Error("Could not update this space.");
  }

  revalidatePath("/dashboard");
  return data as Space;
}

export async function deleteSpace(spaceId: string): Promise<void> {
  const { supabase, user } = await requireUser();

  const { error: archiveErr } = await supabase
    .from("notes")
    .update({ archived: true })
    .eq("space_id", spaceId)
    .eq("user_id", user.id);

  if (archiveErr) {
    console.error("deleteSpace archive notes error:", archiveErr);
    throw new Error("Could not archive notes in this space.");
  }

  const { error } = await supabase
    .from("spaces")
    .delete()
    .eq("id", spaceId)
    .eq("user_id", user.id);

  if (error) {
    console.error("deleteSpace error:", error);
    throw new Error("Could not delete this space.");
  }
  revalidatePath("/dashboard");
}

export async function addNote(noteData: {
  title: string;
  content: string;
  space_id?: string;
}): Promise<Note> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("notes")
    .insert([
      {
        title: noteData.title,
        content: noteData.content,
        space_id: noteData.space_id ?? "general",
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("addNote error:", error);
    throw new Error("Could not add note.");
  }

  revalidatePath("/dashboard");
  return data as Note;
}

// Hard caps to keep payloads sane and rate-limit the engine's input size.
const MAX_TITLE_LEN = 200;
const MAX_CONTENT_LEN = 200_000; // 200KB of markdown — plenty for any single note
const MAX_TAGS = 32;
const MAX_TAG_LEN = 40;

function sanitizeNoteInput(input: {
  title: string;
  content: string;
  tags: string[];
}): { title: string; content: string; tags: string[] } {
  const title = (input.title ?? "").slice(0, MAX_TITLE_LEN);
  const content = (input.content ?? "").slice(0, MAX_CONTENT_LEN);
  // Tag set: dedupe, lowercase, alphanumeric/dash only, length-cap, count-cap.
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of input.tags ?? []) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, MAX_TAG_LEN);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    tags.push(t);
    if (tags.length >= MAX_TAGS) break;
  }
  return { title, content, tags };
}

export async function saveNoteAndConnectToSpace(noteData: {
  id?: string;
  space_id: string;
  title: string;
  content: string;
  tags: string[];
}): Promise<Note> {
  const { supabase, user } = await requireUser();
  const cleaned = sanitizeNoteInput({
    title: noteData.title,
    content: noteData.content,
    tags: noteData.tags,
  });

  const updateQuery = supabase
    .from("notes")
    .update({
      title: cleaned.title,
      content: cleaned.content,
      tags: cleaned.tags,
      space_id: noteData.space_id,
      // Content changed — engine outputs are now stale. The next Process
      // click (or analyze_space.py run) will re-analyse and flip this
      // back to true via mark_notes_processed().
      processed: false,
      last_modified_at: new Date().toISOString(),
    });

  const updated = await (noteData.id
    ? updateQuery.match({ id: noteData.id, user_id: user.id })
    : updateQuery.match({
        user_id: user.id,
        space_id: noteData.space_id,
        title: cleaned.title,
      }))
    .select()
    .maybeSingle();

  if (updated.error) {
    console.error("saveNote update error:", updated.error);
    throw new Error("Could not update the note.");
  }

  if (updated.data) {
    revalidatePath("/dashboard");
    return updated.data as Note;
  }

  const inserted = await supabase
    .from("notes")
    .insert([
      {
        title: cleaned.title,
        content: cleaned.content,
        space_id: noteData.space_id,
        tags: cleaned.tags,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (inserted.error) {
    console.error("saveNote insert error:", inserted.error);
    throw new Error("Could not insert note into the specified space.");
  }

  revalidatePath("/dashboard");
  return inserted.data as Note;
}

export async function archiveNote(noteId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ archived: true })
    .eq("id", noteId);

  if (error) throw new Error("Failed to archive note: " + error.message);
}

export async function pinNote(
  noteId: string,
  pinnedState: boolean,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .update({ pinned: pinnedState })
    .eq("id", noteId);

  if (error) throw new Error("Failed to pin note: " + error.message);
}

export async function duplicateNote(newNoteData: Note): Promise<Note> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("notes")
    .insert([
      {
        title: newNoteData.title,
        content: newNoteData.content,
        space_id: newNoteData.space_id,
        tags: newNoteData.tags,
        user_id: user.id,
      },
    ])
    .select()
    .single();

  if (error) throw new Error("Failed to duplicate note: " + error.message);
  return data as Note;
}

export async function moveNoteToSpace(
  note_id: string,
  newSpace_id: string,
): Promise<Note> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .update({
      space_id: newSpace_id,
      last_modified_at: new Date().toISOString(),
    })
    .eq("id", note_id)
    .select()
    .single();

  if (error) throw new Error("Failed to moveNoteToSpace: " + error.message);
  return data as Note;
}

export async function getNotes(user_id: string): Promise<Note[]> {
  // Opt out of Next's fetch cache. Otherwise the Supabase REST GET can be
  // served from a stale response across the refetch that runs right after
  // the engine flips `processed` in Postgres — that's why the Notes tab
  // needed a full page reload to show new processed state.
  noStore();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user_id)
    .eq("archived", false);

  if (error) {
    console.error("getNotes error:", error.message);
    return [];
  }
  return (data ?? []) as Note[];
}

export async function getMsgHistory(spaceId: string): Promise<Message[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("space_id", spaceId)
    .eq("user_id", user.id)
    .order("timestamp", { ascending: true });

  if (error) {
    console.error("getMsgHistory error:", error.message);
    throw new Error("Failed to load message history.");
  }
  return data as Message[];
}

export async function addMsgHistory(message: {
  space_id: string;
  role: string;
  content: string;
}): Promise<Message> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("messages")
    .insert([
      {
        user_id: user.id,
        space_id: message.space_id,
        content: message.content,
        role: message.role,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("addMsgHistory error:", error.message);
    throw new Error("Failed to add message.");
  }
  return data as Message;
}

export async function updateProfileName(
  firstName: string,
  lastName: string,
): Promise<Profile> {
  const { supabase, user } = await requireUser();

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();

  if (!trimmedFirst) throw new Error("First name cannot be empty.");
  if (trimmedFirst.length > 50) throw new Error("First name is too long.");
  if (trimmedLast.length > 50) throw new Error("Last name is too long.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name: trimmedFirst, last_name: trimmedLast })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("updateProfileName error:", error);
    throw new Error("Could not update your name.");
  }

  await supabase.auth.updateUser({
    data: { first_name: trimmedFirst, last_name: trimmedLast },
  });

  revalidatePath("/dashboard");
  return hydrateProfile(data as Record<string, unknown>);
}

export async function updateProfilePreferences(
  patch: Partial<UserPreferences>,
): Promise<Profile> {
  const { supabase, user } = await requireUser();

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("user_id", user.id)
    .single();

  if (readError) {
    console.error("updateProfilePreferences read error:", readError);
    throw new Error("Could not load preferences.");
  }

  const merged: UserPreferences = {
    ...normalizePreferences(current?.["preferences"]),
    ...patch,
  };

  const { data, error } = await supabase
    .from("profiles")
    .update({ preferences: merged })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error("updateProfilePreferences write error:", error);
    throw new Error("Could not save preferences.");
  }

  return hydrateProfile(data as Record<string, unknown>);
}

// ============================================================
// Engine analysis reads
// ============================================================

export async function getUnprocessedCountsBySpace(
  user_id: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("space_id")
    .eq("user_id", user_id)
    .eq("archived", false)
    .eq("processed", false);
  if (error) {
    console.error("getUnprocessedCountsBySpace error:", error.message);
    return {};
  }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const sid = (row as { space_id: string }).space_id;
    counts[sid] = (counts[sid] ?? 0) + 1;
  }
  return counts;
}

export async function fetchSemanticEdges(
  spaceIds: string[],
): Promise<SemanticEdgeRow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("note_semantic_edges")
    .select("space_id, src_note_id, dst_note_id, similarity, mutual")
    .in("space_id", spaceIds);
  if (error) {
    console.error("fetchSemanticEdges error:", error.message);
    return [];
  }
  return (data ?? []) as SemanticEdgeRow[];
}

const SEM_CLUSTER_COLUMNS =
  "id, space_id, stable_id, label, keywords, note_ids, cohesion, parent_topic, hierarchy_path, evidence_terms, excluded_terms, secondary_topics, llm_confidence, source";

export async function fetchSemanticClusters(
  spaceIds: string[],
): Promise<SemanticClusterRow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("semantic_topic_clusters")
    .select(SEM_CLUSTER_COLUMNS)
    .in("space_id", spaceIds);
  if (error) {
    console.error("fetchSemanticClusters error:", error.message);
    return [];
  }
  return (data ?? []) as SemanticClusterRow[];
}

export async function fetchSimEdges(spaceIds: string[]): Promise<SimEdge[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("note_sim_edges")
    .select(
      "space_id, src_note_id, dst_note_id, weight, confidence, views_supporting",
    )
    .in("space_id", spaceIds);
  if (error) {
    console.error("fetchSimEdges error:", error.message);
    return [];
  }
  return (data ?? []) as SimEdge[];
}

export async function fetchTopicClusters(
  spaceIds: string[],
): Promise<TopicClusterRow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("topic_clusters")
    .select(
      "id, space_id, stable_id, label, keywords, note_ids, centroid_terms, structural_certainty",
    )
    .in("space_id", spaceIds);
  if (error) {
    console.error("fetchTopicClusters error:", error.message);
    return [];
  }
  return (data ?? []) as TopicClusterRow[];
}

export async function fetchPrereqEdgesForSpaces(
  spaceIds: string[],
): Promise<StudyStateEdgeRow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("study_state_edges")
    .select("space_id, src_node_id, dst_node_id, kind, weight")
    .in("space_id", spaceIds)
    .eq("kind", "prerequisite");
  if (error) {
    console.error("fetchPrereqEdgesForSpaces error:", error.message);
    return [];
  }
  return (data ?? []) as StudyStateEdgeRow[];
}

export async function fetchConfusionPairsForSpaces(
  spaceIds: string[],
): Promise<ConfusionPairRow[]> {
  if (spaceIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("confusion_pairs")
    .select(
      "space_id, topic_a, topic_b, score, closeness, separability, interpretive_confidence, shared_core_terms, discriminators_a, discriminators_b",
    )
    .in("space_id", spaceIds);
  if (error) {
    console.error("fetchConfusionPairsForSpaces error:", error.message);
    return [];
  }
  return (data ?? []) as ConfusionPairRow[];
}

export async function fetchSpaceRelationships(
  spaceId: string,
): Promise<SpaceRelationships> {
  const supabase = await createClient();

  const [
    semanticClusters,
    semanticEdges,
    hierarchy,
    ungrouped,
    topics,
    subs,
    confusion,
    hubs,
    diagnostics,
    prereqs,
  ] = await Promise.all([
      supabase
        .from("semantic_topic_clusters")
        .select(SEM_CLUSTER_COLUMNS)
        .eq("space_id", spaceId)
        .order("cohesion", { ascending: false }),
      supabase
        .from("note_semantic_edges")
        .select("space_id, src_note_id, dst_note_id, similarity, mutual")
        .eq("space_id", spaceId)
        .order("similarity", { ascending: false }),
      supabase
        .from("topic_hierarchy_paths")
        .select("space_id, path")
        .eq("space_id", spaceId),
      supabase
        .from("ungrouped_notes")
        .select("space_id, note_id, title, reason")
        .eq("space_id", spaceId),
      supabase
        .from("topic_clusters")
        .select(
          "id, space_id, stable_id, label, keywords, note_ids, centroid_terms, structural_certainty",
        )
        .eq("space_id", spaceId),
      supabase
        .from("topic_subclusters")
        .select("id, space_id, parent_id, label, keywords, note_ids")
        .eq("space_id", spaceId),
      supabase
        .from("confusion_pairs")
        .select(
          "space_id, topic_a, topic_b, score, closeness, separability, interpretive_confidence, shared_core_terms, discriminators_a, discriminators_b",
        )
        .eq("space_id", spaceId)
        .order("score", { ascending: false }),
      supabase
        .from("concept_hubs")
        .select("space_id, term, degree, note_ids")
        .eq("space_id", spaceId)
        .order("degree", { ascending: false })
        .limit(40),
      supabase
        .from("note_diagnostics")
        .select(
          "space_id, note_id, prereq_gap, integration, is_isolated, is_foundational, is_bridge",
        )
        .eq("space_id", spaceId),
      supabase
        .from("study_state_edges")
        .select("space_id, src_node_id, dst_node_id, kind, weight")
        .eq("space_id", spaceId)
        .eq("kind", "prerequisite"),
    ]);

  const warn = (name: string, err: { message: string } | null) => {
    if (err) console.error(`fetchSpaceRelationships ${name}:`, err.message);
  };
  warn("semanticClusters", semanticClusters.error);
  warn("semanticEdges", semanticEdges.error);
  warn("hierarchy", hierarchy.error);
  warn("ungrouped", ungrouped.error);
  warn("topics", topics.error);
  warn("subclusters", subs.error);
  warn("confusion", confusion.error);
  warn("hubs", hubs.error);
  warn("diagnostics", diagnostics.error);
  warn("prereqs", prereqs.error);

  return {
    semanticClusters: (semanticClusters.data ?? []) as SemanticClusterRow[],
    semanticEdges: (semanticEdges.data ?? []) as SemanticEdgeRow[],
    hierarchyPaths: (hierarchy.data ?? []) as TopicHierarchyPathRow[],
    ungrouped: (ungrouped.data ?? []) as UngroupedNoteRow[],
    topics: (topics.data ?? []) as TopicClusterRow[],
    subclusters: (subs.data ?? []) as TopicSubclusterRow[],
    confusion: (confusion.data ?? []) as ConfusionPairRow[],
    hubs: (hubs.data ?? []) as ConceptHubRow[],
    diagnostics: (diagnostics.data ?? []) as NoteDiagnosticRow[],
    prereqEdges: (prereqs.data ?? []) as StudyStateEdgeRow[],
  };
}

export async function fetchProfileByEmail(
  email: string,
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) throw new Error("Error fetching profile: " + error.message);
  if (!data) return null;
  return hydrateProfile(data as Record<string, unknown>);
}
