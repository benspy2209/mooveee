-- 0022 — erase_user exécutable par service_role.
--
-- Le parcours d'effacement complet passe par scripts/erase-user.ts
-- (service role, jamais côté client) : il purge d'abord les objets
-- Storage (photos enfants des foyers qui vont disparaître, photos des
-- meeting points des hubs qui vont être dissous — le SQL ne touche pas
-- aux buckets), puis appelle erase_user(). Les rôles clients (anon,
-- authenticated) restent révoqués — 0021.

grant execute on function erase_user(uuid) to service_role;
