-- auth.users içine yeni kullanıcı eklenince filoLocal.users'da profil oluştur
create or replace function "filoLocal".handle_new_auth_user()
returns trigger language plpgsql security definer
set search_path = public, "filoLocal", auth
as $$
begin
  insert into "filoLocal".users (id, full_name, email, phone, user_type)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), 'User'),
    new.email,
    new.phone,
    coalesce(
      (new.raw_user_meta_data ->> 'user_type')::"filoLocal".user_type,
      'employee'::"filoLocal".user_type
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function "filoLocal".handle_new_auth_user();;
