create policy users_self_insert on users for insert with check (id = auth.uid());
