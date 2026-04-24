# Features

Current state of dot-rewrite. Progress tracker.

## Core shell

| Feature | Status | Notes |
|---|---|---|
| Auth (sign-in / sign-up / forgot / callback) | done | Supabase SSR, cookie-based |
| Landing (home + blog + changelog + pricing) | done | Ported |
| Dashboard shell + tabs (Editor / Notes / Nexus / Dot / Settings) | done | 200px sidebar, 1600x1000 card, scales to viewport |
| Theme (system / light / dark) | done | class-based, pre-paint inline script, no flash |
| User preferences (server jsonb) | done | theme + response_style + auto_summaries |
| Dark-mode parity across UI | done | pair light + dark tokens on all surfaces |

## Editor

| Feature | Status | Notes |
|---|---|---|
| Markdown editor with live preview | done | remark-gfm, remark-math, emoji, rehype-highlight/sanitize/katex/prism |
| Syntax-highlighted code blocks | done | prism + highlight.js |
| Title + tag + space selector | done | duplicate-title detection |
| localStorage draft restore | done | snapshot-synced to prevent false-dirty |
| Unsaved-changes guard | done | `EditorApi` ref, empty-note short-circuit, dirty diff |
| Save-by-hold gesture | done | 1.5s progress ring |
| PDF export (real) | done | jspdf + html2canvas-pro multi-page A4 |
| Update existing note by id | done | no dup on title change |
| Plain `<img>` render in markdown | done | bypass next/image hostname restriction |

## Notes view

| Feature | Status | Notes |
|---|---|---|
| List all notes + pin + archive | done | |
| Note view modal (read-only) | done | 1200x900 max, tabs: Content / Outline / TL;DR |
| Outline tab | placeholder | heading scan; AI generation pending |
| TL;DR tab | placeholder | truncated excerpt; AI generation pending |
| Eye icon to view + Edit icon to open editor | done | |
| Empty state | done | |

## Spaces

| Feature | Status | Notes |
|---|---|---|
| Create / edit / delete space | done | archives notes on delete |
| 12 preset colors + hex validation | done | |
| Code uniqueness validation | done | 23505 duplicate catch |
| Inline rename via hover menu | done | MoreHorizontal → Edit / Delete |

## Nexus

| Feature | Status | Notes |
|---|---|---|
| d3 force graph of notes | done | |
| Filter by space | done | |
| Search by title / tag / content | done | |
| Zoom + pan + drag | done | |
| Shared-tag relation links | placeholder | only same-space links for now |
| Generated clusters panel | planned | |
| Side panel: tags, recent | planned | |
| Empty state | done | |

## Dot (agent)

| Feature | Status | Notes |
|---|---|---|
| Agent input card (textarea + note selector) | done | |
| Run Dot (mock) | mock | 50s fake wait, returns echo |
| Message history dropdown | done | |
| Loading / Empty states | done | animated |
| Light-mode text visibility in Dot pane | bug-tracking | reported, under investigation |
| Real AI pipeline | planned | edge function scaffold exists |

## Edge function

| Feature | Status | Notes |
|---|---|---|
| `process-note` scaffold | done | CORS + bearer auth + user-scoped fetch |
| RLS audit | done | all queries scoped by `user_id` |
| Real LLM call | planned | |

## Settings

| Feature | Status | Notes |
|---|---|---|
| Theme picker | done | syncs profile + ThemeProvider |
| Response style | done | concise / balanced / explanatory |
| Auto-summaries toggle | done | |
| Unsaved-changes guard | done | mirror EditorApi pattern |

## Cross-cutting

| Feature | Status | Notes |
|---|---|---|
| ErrorBoundary wrapping dashboard | done | |
| Toast coverage (sonner) | done | mutations + queries |
| Mobile-scaled dashboard card | done | transform scale, fits viewport |
| Sign-out confirmation modal | done | |
| Auth redirect polish (landing ↔ dashboard) | done | async root, async (auth) layout |
| Empty states across views | done | |
