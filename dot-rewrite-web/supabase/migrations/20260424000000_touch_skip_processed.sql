-- Don't bump last_modified_at when only engine/processing flags change.
-- Only real user edits (title, content, tags, space_id) should touch it.

create or replace function public.touch_last_modified()
returns trigger
language plpgsql
as $$
begin
  if new.title    is distinct from old.title
  or new.content  is distinct from old.content
  or new.tags     is distinct from old.tags
  or new.space_id is distinct from old.space_id then
    new.last_modified_at := now();
  end if;
  return new;
end;
$$;
