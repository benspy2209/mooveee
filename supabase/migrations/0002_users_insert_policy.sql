drop policy if exists users_self_insert on users;

create policy users_self_insert on users for insert
  with check (id = auth.uid());
