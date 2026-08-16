/**
 * Effacement RGPD complet d'un compte — usage opérateur uniquement.
 *
 * Enchaîne ce que le SQL seul ne peut pas faire : purge des objets
 * Storage (le cascade SQL ne supprime jamais les fichiers), puis appel
 * de erase_user() (migration 0021) qui détache le conducteur, transfère
 * ou dissout les hubs possédés, supprime le foyer si l'utilisateur en
 * était le seul membre, et efface le compte auth.
 *
 * Usage :
 *   npm run erase-user -- <email>
 *
 * Variables (lues depuis .env.local) : VITE_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Jamais côté client : erase_user est
 * révoquée pour anon et authenticated (0021), grantée à service_role
 * (0022).
 *
 * Périmètre Storage purgé, calqué sur la logique de erase_user() :
 *   - child-photos/{household_id}/*  pour chaque foyer dont
 *     l'utilisateur est le SEUL membre (le foyer sera supprimé) ;
 *   - meeting-point-photos/{hub_id}/*  pour chaque hub possédé SANS
 *     autre membre validé (le hub sera dissous).
 * Les foyers et hubs qui survivent gardent leurs fichiers.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  console.error('VITE_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (.env.local).')
  process.exit(1)
}

const [email] = process.argv.slice(2)
if (!email) {
  console.error('Usage : npm run erase-user -- <email>')
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserIdByEmail(target: string): Promise<string | null> {
  const wanted = target.toLowerCase()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error(`listUsers a échoué : ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) return match.id
    if (data.users.length < 100) return null
    page += 1
  }
}

async function purgeFolder(bucket: string, folder: string): Promise<number> {
  const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 1000 })
  if (error) throw new Error(`list ${bucket}/${folder} : ${error.message}`)
  if (!data || data.length === 0) return 0
  const paths = data.map((o) => `${folder}/${o.name}`)
  const { error: removeError } = await admin.storage.from(bucket).remove(paths)
  if (removeError) throw new Error(`remove ${bucket}/${folder} : ${removeError.message}`)
  return paths.length
}

const userId = await findUserIdByEmail(email)
if (!userId) {
  console.error(`Aucun compte avec l'email ${email}.`)
  process.exit(1)
}

// Foyers dont l'utilisateur est le seul membre (ils seront supprimés).
const { data: memberships, error: mErr } = await admin
  .from('household_members')
  .select('household_id')
  .eq('user_id', userId)
if (mErr) throw new Error(mErr.message)

let photosRemoved = 0
for (const m of memberships ?? []) {
  const { count, error } = await admin
    .from('household_members')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', m.household_id)
    .neq('user_id', userId)
  if (error) throw new Error(error.message)
  if ((count ?? 0) === 0) {
    photosRemoved += await purgeFolder('child-photos', m.household_id)
  }
}

// Hubs possédés sans autre membre validé (ils seront dissous).
const { data: ownedHubs, error: hErr } = await admin
  .from('hubs')
  .select('id')
  .eq('owner_id', userId)
if (hErr) throw new Error(hErr.message)

let mpPhotosRemoved = 0
for (const hub of ownedHubs ?? []) {
  const { count, error } = await admin
    .from('hub_members')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', hub.id)
    .neq('user_id', userId)
    .not('validated_at', 'is', null)
  if (error) throw new Error(error.message)
  if ((count ?? 0) === 0) {
    mpPhotosRemoved += await purgeFolder('meeting-point-photos', hub.id)
  }
}

const { error: eraseError } = await admin.rpc('erase_user', { p_user: userId })
if (eraseError) {
  console.error(`erase_user a échoué : ${eraseError.message}`)
  console.error('Les fichiers Storage déjà purgés ne sont pas restaurables.')
  process.exit(1)
}

console.log(
  `Compte ${email} (${userId}) effacé. Photos supprimées : ` +
    `${photosRemoved} enfant(s), ${mpPhotosRemoved} meeting point(s).`,
)
