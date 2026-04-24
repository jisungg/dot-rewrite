-- Add per-user preferences to profiles.
-- Stores theme (system|light|dark), AI response style, and auto-summary toggle.

alter table public.profiles
  add column if not exists preferences jsonb not null default jsonb_build_object(
    'theme', 'system',
    'response_style', 'balanced',
    'auto_summaries', true
  );

-- Existing rows: fill in defaults where null (the default above only applies to new inserts).
update public.profiles
  set preferences = jsonb_build_object(
    'theme', 'system',
    'response_style', 'balanced',
    'auto_summaries', true
  )
  where preferences is null;
