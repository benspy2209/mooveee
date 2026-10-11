// access-code-login — connexion par code d'accès SANS email dans le bundle.
//
// Contexte (rétro cadrage du 11/10/2026, trou B.1) : la table
// préfixe → email vivait dans src/routes/login.tsx, donc dans le bundle
// public de www.mooveee.app. Elle vit désormais dans le secret
// ACCESS_CODE_EMAILS (JSON {"prefixe": "email"}), lu ici uniquement.
//
// Le client envoie { code } ; le préfixe (avant le premier tiret) désigne
// le compte, le code complet est le mot de passe Supabase posé par
// `npm run set-dev-password`. La fonction fait le signInWithPassword avec
// la clé anon et renvoie les jetons ; le client appelle setSession.
//
// Mode PROVISOIRE (décision D2) : à supprimer avec le mode code d'accès
// dès que l'authentification par email (Brevo) fonctionne.
//
// Déployée avec verify_jwt = false : l'appelant n'est pas encore connecté.
// Aucune donnée enfant, aucune écriture en base. Rate limiting : celui de
// Supabase Auth sur /token, plus une réponse identique pour « préfixe
// inconnu » et « mot de passe faux » (pas d'énumération des comptes).

import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const INVALID = { error: 'Code d’accès invalide.' }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée.' }, 405)
  }

  let code = ''
  try {
    const body = await req.json()
    code = typeof body?.code === 'string' ? body.code.trim().toLowerCase() : ''
  } catch {
    return json({ error: 'Requête invalide.' }, 400)
  }
  if (!code || code.length > 64) {
    return json(INVALID, 401)
  }

  const raw = Deno.env.get('ACCESS_CODE_EMAILS')
  if (!raw) {
    return json(
      { error: 'Connexion par code non configurée (ACCESS_CODE_EMAILS).' },
      503,
    )
  }
  let mapping: Record<string, string>
  try {
    mapping = JSON.parse(raw)
  } catch {
    return json({ error: 'Configuration ACCESS_CODE_EMAILS invalide.' }, 503)
  }

  const email = mapping[code.split('-')[0]]
  if (!email) {
    return json(INVALID, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: code,
  })

  if (error || !data.session) {
    if (error && /disabled/i.test(error.message)) {
      return json(
        {
          error:
            'Connexion par code désactivée côté Supabase. À activer dans Authentication → Sign In / Providers.',
        },
        503,
      )
    }
    return json(INVALID, 401)
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })
})
