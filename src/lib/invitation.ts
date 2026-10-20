// Invitation à un hub reçue par lien (WhatsApp, SMS, email).
//
// Le lien partagé est `<origine>/rejoindre?code=ABC123`. Il ne donne
// aucun accès par lui-même : il transporte seulement le code d'adhésion
// déjà affiché dans l'écran Hubs. La personne doit se connecter, accepter
// le Pacte de Hub, puis être validée par un responsable du hub avant de
// voir quoi que ce soit (arbitrage du porteur, 20/10/2026).
//
// Le code est mémorisé ici parce que le parcours de connexion recharge la
// page : le lien magique revient sur l'origine, pas sur /rejoindre. Il est
// gardé dans localStorage, avec une péremption courte, et effacé dès que
// la demande est envoyée. Aucune donnée personnelle : un code de hub
// public, le même que celui qu'on lit à voix haute dans une cour d'école.

const STORAGE_KEY = 'mooveee:hub-invitation'
const MAX_AGE_MS = 2 * 60 * 60 * 1000

// Même alphabet que generateJoinCode côté hubs : 3 lettres sans I/L/O,
// puis 3 chiffres sans 0/1. On valide le format pour ne pas garder
// n'importe quel paramètre d'URL.
const CODE_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ]{3}[23456789]{3}$/

export interface PendingInvitation {
  code: string
  receivedAt: number
}

export function normalizeJoinCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return CODE_PATTERN.test(code) ? code : null
}

export function rememberInvitation(code: string): void {
  const valid = normalizeJoinCode(code)
  if (!valid) return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ code: valid, receivedAt: Date.now() }),
    )
  } catch {
    // Navigation privée, stockage refusé : l'invitation ne survivra pas au
    // rechargement. La personne peut toujours saisir le code à la main.
  }
}

export function readInvitation(): PendingInvitation | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    forgetInvitation()
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) {
    forgetInvitation()
    return null
  }
  const { code, receivedAt } = parsed as Record<string, unknown>
  if (typeof code !== 'string' || typeof receivedAt !== 'number') {
    forgetInvitation()
    return null
  }
  const valid = normalizeJoinCode(code)
  if (!valid || Date.now() - receivedAt > MAX_AGE_MS) {
    forgetInvitation()
    return null
  }
  return { code: valid, receivedAt }
}

export function forgetInvitation(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Rien à faire : au pire le code périme tout seul.
  }
}

export function invitationLink(code: string, origin: string): string {
  return `${origin}/rejoindre?code=${encodeURIComponent(code)}`
}

// Message prêt à partager. `wa.me` ouvre WhatsApp sur mobile comme sur
// ordinateur, sans compte professionnel ni interface de programmation ;
// le même texte sert pour un SMS ou un email.
export function invitationMessage(hubName: string, link: string): string {
  return (
    `Bonjour, je t'invite à rejoindre « ${hubName} » sur Mooveee, ` +
    `pour partager les trajets des enfants entre familles : ${link}`
  )
}

export function whatsappShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
