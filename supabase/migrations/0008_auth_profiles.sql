create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_full_name text;
  resolved_display_name text;
  resolved_phone text;
  normalized_email text;
begin
  resolved_full_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  resolved_display_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  resolved_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '');
  normalized_email := lower(new.email);

  if resolved_full_name is null then
    resolved_full_name := coalesce(resolved_display_name, split_part(coalesce(normalized_email, 'resident'), '@', 1));
  end if;

  if resolved_display_name is null then
    resolved_display_name := resolved_full_name;
  end if;

  insert into public.profiles (
    id,
    full_name,
    display_name,
    phone,
    email,
    role,
    is_active
  )
  values (
    new.id,
    resolved_full_name,
    resolved_display_name,
    resolved_phone,
    normalized_email,
    'resident',
    true
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

create or replace function public.update_own_profile(
  new_display_name text default null,
  new_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.profiles p
  set
    display_name = case
      when new_display_name is null then p.display_name
      else nullif(trim(new_display_name), '')
    end,
    phone = case
      when new_phone is null then p.phone
      else nullif(trim(new_phone), '')
    end,
    updated_at = now()
  where p.id = auth.uid()
    and p.is_active = true
  returning p.* into updated_profile;

  if not found then
    raise exception 'profile not found or inactive';
  end if;

  return updated_profile;
end;
$$;

grant execute on function public.update_own_profile(text, text) to authenticated;
