-- ============================================================
-- AthletiX (OPTIONAL): only allow sign-ups with your school's email domain.
-- Use this only after the school agrees. Existing accounts keep working.
-- Also switch ON email confirmation (Authentication > Sign In / Providers > Email > Confirm email),
-- so nobody can sign up with a school address they don't own.
-- 1. Replace  yourschool.az  below with the school's real email domain
--    (the part after @). For two domains: in ('school.az', 'students.school.az')
-- 2. Supabase: SQL Editor > New query > paste > Run.
-- To switch it off later, run:  drop trigger if exists only_school_emails on auth.users;
-- ============================================================

create or replace function public.only_school_emails()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) not in ('yourschool.az') then
    raise exception 'Please sign up with your school email address.';
  end if;
  return new;
end;
$$;

drop trigger if exists only_school_emails on auth.users;
create trigger only_school_emails
  before insert or update of email on auth.users
  for each row execute function public.only_school_emails();
