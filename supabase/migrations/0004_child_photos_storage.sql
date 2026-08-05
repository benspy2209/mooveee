-- =====================================================================
-- 0004 — Photos d'enfants : bucket Storage privé + policies
--
-- Bucket child-photos, PRIVÉ, jamais public : l'accès se fait
-- exclusivement par URL signée de courte durée, générée côté client
-- uniquement si children.photo_consent = true (§9.2).
--
-- Chemin des objets : {household_id}/{child_id}.{ext}
-- Le premier segment du chemin est le household_id : les policies
-- ci-dessous restreignent toute opération aux membres de ce foyer,
-- via le helper auth_household_ids() existant (0001).
--
-- Les contraintes du bucket (allowed_mime_types, file_size_limit)
-- constituent la validation CÔTÉ SERVEUR de l'upload : images
-- jpeg/png/webp uniquement, 5 Mo maximum. La validation côté client
-- dans le formulaire n'est qu'un confort ; c'est le bucket qui fait
-- autorité.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'child-photos',
  'child-photos',
  false,
  5242880, -- 5 Mo
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- --- policies sur storage.objects ------------------------------------
-- Une opération n'est permise que si le premier segment du chemin
-- ((storage.foldername(name))[1]) est un household_id dont
-- l'utilisateur authentifié est membre.

drop policy if exists child_photos_select on storage.objects;
create policy child_photos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_household_ids() as h
    )
  );

drop policy if exists child_photos_insert on storage.objects;
create policy child_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_household_ids() as h
    )
  );

drop policy if exists child_photos_update on storage.objects;
create policy child_photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_household_ids() as h
    )
  )
  with check (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_household_ids() as h
    )
  );

drop policy if exists child_photos_delete on storage.objects;
create policy child_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'child-photos'
    and (storage.foldername(name))[1] in (
      select h::text from auth_household_ids() as h
    )
  );

comment on column public.children.photo_url is
  'Chemin RELATIF dans le bucket privé child-photos '
  '({household_id}/{child_id}.{ext}), jamais une URL publique. '
  'Servi uniquement par URL signée de courte durée, et uniquement '
  'si photo_consent = true. La suppression des objets Storage est '
  'explicite côté application : le cascade SQL ne supprime pas les '
  'fichiers.';
