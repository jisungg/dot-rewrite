import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClient } from "@/utils/supabase/server";
import { rateLimit, maybeSweep } from "@/lib/api/rate-limit";

// Local-dev helper: kick off the Python engine per space owned by the caller,
// then return immediately. Runs go to a detached child so the HTTP request
// isn't held open for the full 10–60s analysis. Clients poll
// GET /api/analyze-space?spaceIds=... which consults the engine-owned
// `analysis_runs` table.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENGINE_DIR =
  process.env["ENGINE_DIR"] ??
  path.resolve(process.cwd(), "..", "dot-rewrite-engine");

function resolveUv(): string {
  const explicit = process.env["UV_BIN"];
  if (explicit && fs.existsSync(explicit)) return explicit;
  const candidates = [
    path.join(os.homedir(), ".local/bin/uv"),
    path.join(os.homedir(), ".cargo/bin/uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
    "/usr/bin/uv",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return "uv"; // fall back to PATH resolution
}

function spawnEngine(spaceId: string): void {
  const uv = resolveUv();
  const logDir = path.join(ENGINE_DIR, ".logs");
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // best-effort
  }
  const logPath = path.join(logDir, `analyze-${spaceId}.log`);
  const out = fs.openSync(logPath, "a");
  const err = fs.openSync(logPath, "a");
  const child = spawn(
    uv,
    ["run", "python", "analyze_space.py", "--space-id", spaceId],
    {
      cwd: ENGINE_DIR,
      env: process.env,
      detached: true,
      stdio: ["ignore", out, err],
    },
  );
  child.unref();
}

export async function POST(req: Request) {
  let body: { spaceId?: string; spaceIds?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ids = body.spaceIds ?? (body.spaceId ? [body.spaceId] : []);
  if (ids.length === 0) {
    return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  maybeSweep();
  const rl = rateLimit(user.id, "engine_run");
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", detail: `Try again in ${rl.retryAfter}s.` },
      { status: 429, headers: { "retry-after": String(rl.retryAfter) } },
    );
  }

  const { data: owned, error: ownErr } = await supabase
    .from("spaces")
    .select("id")
    .eq("user_id", user.id)
    .in("id", ids);
  if (ownErr) {
    return NextResponse.json({ error: "owner_check_failed" }, { status: 500 });
  }
  const ownedIds = new Set((owned ?? []).map((r) => (r as { id: string }).id));
  const unowned = ids.filter((id) => !ownedIds.has(id));
  if (unowned.length > 0) {
    return NextResponse.json(
      { error: "not_owner", spaces: unowned },
      { status: 403 },
    );
  }

  // Skip spaces that already have a `running` analysis to avoid double-spawning.
  const { data: running } = await supabase
    .from("analysis_runs")
    .select("space_id, id, started_at")
    .in("space_id", ids)
    .eq("status", "running");
  const alreadyRunning = new Set(
    (running ?? []).map((r) => (r as { space_id: string }).space_id),
  );

  const started: string[] = [];
  for (const id of ids) {
    if (alreadyRunning.has(id)) continue;
    try {
      spawnEngine(id);
      started.push(id);
    } catch (err) {
      console.error("spawnEngine failed:", id, err);
    }
  }

  return NextResponse.json(
    {
      ok: true,
      started,
      already_running: Array.from(alreadyRunning),
    },
    { status: 202 },
  );
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const param = url.searchParams.get("spaceIds") ?? "";
  const ids = param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json({ error: "missing_space_id" }, { status: 400 });
  }

  // Verify ownership (engine table has RLS but be defensive).
  const { data: owned } = await supabase
    .from("spaces")
    .select("id")
    .eq("user_id", user.id)
    .in("id", ids);
  const ownedIds = new Set((owned ?? []).map((r) => (r as { id: string }).id));

  const { data: runs } = await supabase
    .from("analysis_runs")
    .select("id, space_id, status, started_at, finished_at, notes")
    .in("space_id", ids)
    .order("started_at", { ascending: false });

  const latestPerSpace = new Map<
    string,
    {
      id: string;
      space_id: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      notes: string | null;
    }
  >();
  for (const r of (runs ?? []) as {
    id: string;
    space_id: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    notes: string | null;
  }[]) {
    if (!latestPerSpace.has(r.space_id)) latestPerSpace.set(r.space_id, r);
  }

  const statuses = ids.map((id) => {
    if (!ownedIds.has(id)) return { space_id: id, status: "not_owner" as const };
    const r = latestPerSpace.get(id);
    if (!r) return { space_id: id, status: "none" as const };
    return {
      space_id: id,
      status: r.status,
      started_at: r.started_at,
      finished_at: r.finished_at,
      notes: r.notes,
    };
  });

  const allDone = statuses.every((s) =>
    s.status === "ok" || s.status === "failed" || s.status === "none",
  );

  return NextResponse.json({ allDone, statuses });
}
