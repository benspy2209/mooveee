/**
 * Définit un mot de passe sur un compte de test — usage local uniquement.
 *
 * Contournement du SMTP Supabase plafonné : permet la connexion de
 * développement par mot de passe sur /login (visible en dev seulement).
 *
 * Usage :
 *   npm run set-dev-password -- <email> <mot-de-passe>
 *
 * Variables d'environnement (lues depuis .env.local via --env-file-if-exists) :
 *   SUPABASE_SERVICE_ROLE_KEY  clé service_role du projet.
 *     À récupérer dans le dashboard Supabase : Project Settings → API →
 *     service_role. Jamais préfixée VITE_ (elle serait embarquée dans le
 *     bundle client), jamais commitée (.env.local est dans le .gitignore).
 *   VITE_SUPABASE_URL          URL du projet, déjà présente dans .env.local.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error(
    'SUPABASE_SERVICE_ROLE_KEY absente. Ajoute-la dans .env.local (jamais commitée, jamais VITE_).',
  )
  console.error('Dashboard Supabase → Project Settings → API → service_role.')
  process.exit(1)
}

if (!url) {
  console.error('VITE_SUPABASE_URL (ou SUPABASE_URL) absente de .env.local.')
  process.exit(1)
}

const [email, password] = process.argv.slice(2)

if (!email || !password) {
  console.error('Usage : npm run set-dev-password -- <email> <mot-de-passe>')
  process.exit(1)
}

if (password.length < 6) {
  console.error(
    'Mot de passe trop court : Supabase exige 6 caractères minimum.',
  )
  process.exit(1)
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function findUserIdByEmail(target: string): Promise<string | null> {
  const wanted = target.toLowerCase()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 100,
    })
    if (error) {
      throw new Error(`listUsers a échoué : ${error.message}`)
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted)
    if (match) return match.id
    if (data.users.length < 100) return null
    page += 1
  }
}

const userId = await findUserIdByEmail(email)

if (!userId) {
  console.error(`Aucun compte avec l'email ${email} dans ce projet Supabase.`)
  process.exit(1)
}

const { error } = await admin.auth.admin.updateUserById(userId, { password })

if (error) {
  console.error(`updateUserById a échoué : ${error.message}`)
  process.exit(1)
}

console.log(`Mot de passe défini pour ${email} (${userId}).`)
