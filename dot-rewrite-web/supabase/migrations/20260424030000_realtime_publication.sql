-- Enable Supabase Realtime on the tables the UI reacts to.
-- Idempotent: ALTER PUBLICATION ... ADD TABLE errors if the table is already
-- in the publication, so wrap each in a DO block that swallows that.

do $$ begin
  alter publication supabase_realtime add table public.notes;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.spaces;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.analysis_runs;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.semantic_topic_clusters;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.note_semantic_edges;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.note_diagnostics;
exception when duplicate_object then null; end $$;
