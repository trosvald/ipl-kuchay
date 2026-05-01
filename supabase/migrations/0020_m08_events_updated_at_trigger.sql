-- Phase 4 follow-up: ensure event lifecycle updates remain timestamp-auditable

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();
