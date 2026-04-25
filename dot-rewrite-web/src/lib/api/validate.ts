import "server-only";
// Shared input validation for API routes. Throws `HttpError` on bad input
// so route handlers can do `try { ... } catch (e) { return errorResponse(e) }`
// for a consistent error envelope: `{ error: <code>, detail?: <string> }`.

import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;
  code: string;
  detail?: string;
  constructor(status: number, code: string, detail?: string) {
    super(detail ?? code);
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUUID(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

export function requireUUID(v: unknown, name: string): string {
  if (!isUUID(v)) {
    throw new HttpError(400, "invalid_uuid", `${name} must be a UUID`);
  }
  return v;
}

export function optionalUUID(v: unknown, name: string): string | null {
  if (v === undefined || v === null) return null;
  return requireUUID(v, name);
}

export type StringOpts = { min?: number; max?: number; trim?: boolean };

export function requireString(
  v: unknown,
  name: string,
  opts: StringOpts = {},
): string {
  if (typeof v !== "string") {
    throw new HttpError(400, "invalid_type", `${name} must be a string`);
  }
  const out = opts.trim === false ? v : v;
  if (opts.min !== undefined && out.length < opts.min) {
    throw new HttpError(
      400,
      "too_short",
      `${name} must be at least ${opts.min} characters`,
    );
  }
  if (opts.max !== undefined && out.length > opts.max) {
    throw new HttpError(
      413,
      "too_long",
      `${name} must be ≤ ${opts.max} characters`,
    );
  }
  return out;
}

export function optionalString(
  v: unknown,
  name: string,
  opts: StringOpts = {},
): string | null {
  if (v === undefined || v === null || v === "") return null;
  return requireString(v, name, opts);
}

export function requireInt(
  v: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new HttpError(400, "invalid_int", `${name} must be an integer`);
  }
  if (opts.min !== undefined && n < opts.min) {
    throw new HttpError(
      400,
      "out_of_range",
      `${name} must be ≥ ${opts.min}`,
    );
  }
  if (opts.max !== undefined && n > opts.max) {
    throw new HttpError(
      400,
      "out_of_range",
      `${name} must be ≤ ${opts.max}`,
    );
  }
  return n;
}

export function requireUUIDArray(
  v: unknown,
  name: string,
  opts: { min?: number; max?: number } = {},
): string[] {
  if (!Array.isArray(v)) {
    throw new HttpError(400, "invalid_type", `${name} must be an array`);
  }
  if (opts.min !== undefined && v.length < opts.min) {
    throw new HttpError(
      400,
      "too_short",
      `${name} must have at least ${opts.min} items`,
    );
  }
  if (opts.max !== undefined && v.length > opts.max) {
    throw new HttpError(
      413,
      "too_long",
      `${name} must have ≤ ${opts.max} items`,
    );
  }
  for (let i = 0; i < v.length; i++) {
    if (!isUUID(v[i])) {
      throw new HttpError(
        400,
        "invalid_uuid",
        `${name}[${i}] must be a UUID`,
      );
    }
  }
  return v as string[];
}

export function requireBool(v: unknown, name: string): boolean {
  if (typeof v !== "boolean") {
    throw new HttpError(400, "invalid_type", `${name} must be a boolean`);
  }
  return v;
}

export async function parseJSONBody<T = Record<string, unknown>>(
  req: Request,
  opts: { maxBytes?: number } = {},
): Promise<T> {
  const max = opts.maxBytes ?? 200_000;
  // Defend against pathological payloads: Next will already cap at the
  // serverActions limit, but enforce ours explicitly so callers can't
  // exhaust memory on a streaming body.
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("application/json")) {
    throw new HttpError(400, "invalid_content_type");
  }
  const len = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(len) && len > max) {
    throw new HttpError(413, "payload_too_large");
  }
  let body: T;
  try {
    body = (await req.json()) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "invalid_json");
  }
  return body;
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json(
      { error: err.code, detail: err.detail },
      { status: err.status },
    );
  }
  console.error("api: unhandled error:", err);
  const detail = err instanceof Error ? err.message : undefined;
  return NextResponse.json(
    { error: "internal_error", detail },
    { status: 500 },
  );
}
