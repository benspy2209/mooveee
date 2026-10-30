// Accompagnement du parent : quelle est sa prochaine étape ?
//
// Une seule fonction, pure, sans accès réseau ni React. Elle prend l'état
// du foyer tel qu'il est en base et renvoie l'étape suivante, son libellé
// et où aller. Trois usages, aujourd'hui et demain :
//
//  1. la carte d'accompagnement en tête de la Semaine ;
//  2. la reprise après interruption — l'étape se DÉDUIT de la base, elle
//     n'est jamais stockée, donc rien à synchroniser ni à périmer ;
//  3. plus tard l'assistant vocal : quand un parent dira « je peux faire
//     l'aller mais pas le retour », c'est cette même fonction qui dira
//     ce qui manque encore.
//
// Règle de fond (retour du porteur, 21/10/2026) : la progression ne
// dépend pas que du parent. Une étape peut être « votre demande attend
// une réponse », et elle n'a alors AUCUNE action. Promettre une
// progression continue mentirait sur la nature de l'entraide.
//
// Vocabulaire imposé (CLAUDE.md) : aide apportée, aide reçue, places
// offertes. Jamais crédit, solde, gagner, dépenser.

export type EtapeCle =
  | 'profil'
  | 'foyer'
  | 'enfant'
  | 'hub'
  | 'hub_en_attente'
  | 'activite'
  | 'trajet'
  | 'pret'

export interface EtatParcours {
  aProfil: boolean
  aFoyer: boolean
  nbEnfants: number
  nbHubsValides: number
  nbHubsEnAttente: number
  nbActivites: number
  nbTrajets: number
}

export interface Etape {
  cle: EtapeCle
  titre: string
  detail: string
  /** null quand l'étape ne dépend pas du parent : il n'y a rien à cliquer. */
  action: { libelle: string; to: string } | null
  /** Position dans le parcours, pour la barre de progression. */
  rang: number
  total: number
}

const TOTAL = 6

export function prochaineEtape(etat: EtatParcours): Etape {
  if (!etat.aProfil) {
    return {
      cle: 'profil',
      titre: 'Dites-nous votre prénom',
      detail: 'Les autres familles le verront à côté de vos trajets.',
      action: { libelle: 'Compléter mon profil', to: '/bienvenue' },
      rang: 1,
      total: TOTAL,
    }
  }

  if (!etat.aFoyer) {
    return {
      cle: 'foyer',
      titre: 'Créez votre foyer',
      detail:
        'Votre foyer rassemble vos enfants et les adultes qui conduisent.',
      action: { libelle: 'Créer mon foyer', to: '/foyer' },
      rang: 2,
      total: TOTAL,
    }
  }

  if (etat.nbEnfants === 0) {
    return {
      cle: 'enfant',
      titre: 'Ajoutez votre enfant',
      detail: 'Son prénom suffit pour commencer.',
      action: { libelle: 'Ajouter un enfant', to: '/enfants' },
      rang: 3,
      total: TOTAL,
    }
  }

  // L'attente de validation passe AVANT la proposition de rejoindre un
  // autre hub : sinon on inviterait la famille à recommencer alors
  // qu'elle a déjà fait sa part.
  if (etat.nbHubsValides === 0 && etat.nbHubsEnAttente > 0) {
    return {
      cle: 'hub_en_attente',
      titre: 'Votre demande attend une réponse',
      detail:
        'Un responsable du groupe doit accepter votre famille. Vous verrez les trajets dès que ce sera fait.',
      action: null,
      rang: 4,
      total: TOTAL,
    }
  }

  if (etat.nbHubsValides === 0) {
    return {
      cle: 'hub',
      titre: 'Rejoignez un groupe de familles',
      detail:
        'Avec le code reçu d’une autre famille, ou le lien d’invitation partagé.',
      action: { libelle: 'Rejoindre un groupe', to: '/hubs' },
      rang: 4,
      total: TOTAL,
    }
  }

  if (etat.nbActivites === 0) {
    return {
      cle: 'activite',
      titre: 'Ajoutez une activité',
      detail:
        'Le tennis du mercredi, l’école, le foot : les trajets aller et retour en découlent.',
      action: { libelle: 'Ajouter une activité', to: '/activites' },
      rang: 5,
      total: TOTAL,
    }
  }

  if (etat.nbTrajets === 0) {
    return {
      cle: 'trajet',
      titre: 'Vos trajets ne sont pas encore générés',
      detail:
        'Vérifiez les jours et les horaires de votre activité : les trajets en découlent.',
      action: { libelle: 'Voir mes activités', to: '/activites' },
      rang: 6,
      total: TOTAL,
    }
  }

  return {
    cle: 'pret',
    titre: 'Tout est en place',
    detail: 'Vous pouvez proposer des places ou en demander.',
    action: null,
    rang: TOTAL,
    total: TOTAL,
  }
}

/** Vrai tant que la configuration n'est pas terminée. */
export function configurationIncomplete(etat: EtatParcours): boolean {
  return prochaineEtape(etat).cle !== 'pret'
}

// ---------------------------------------------------------------------
// Statut d'un trajet, tel qu'il s'affiche dans la semaine.
//
// « À couvrir » disait trop peu : un parent ne savait pas s'il devait
// agir, s'il avait déjà demandé de l'aide, ou s'il attendait une
// réponse (retour du porteur, 30/10/2026). Cinq états explicites, dans
// son vocabulaire.
//
// Règle tenue : « aide demandée » et « en attente d'accord » ne sont
// PAS des solutions. Seul « confirmé » veut dire qu'un conducteur est
// engagé.
// ---------------------------------------------------------------------

export type StatutTrajet =
  | 'annule'
  | 'a_organiser'
  | 'je_conduis'
  | 'aide_demandee'
  | 'attente_accord'
  | 'confirme'

export interface EtatTrajet {
  annule: boolean
  /** Conducteur désigné, ou null. */
  conducteurId: string | null
  /** Identifiants des adultes de mon foyer. */
  mesUserIds: Array<string>
  publieAuHub: boolean
  /** Demandes de place encore sans réponse sur ce trajet. */
  demandesEnAttente: number
}

export function statutTrajet(etat: EtatTrajet): StatutTrajet {
  if (etat.annule) return 'annule'

  if (etat.conducteurId) {
    return etat.mesUserIds.includes(etat.conducteurId)
      ? 'je_conduis'
      : 'confirme'
  }

  // Sans conducteur : ce que le parent a déjà entrepris prime sur
  // l'absence de solution, sinon on lui redemande d'agir alors qu'il
  // attend quelqu'un.
  if (etat.demandesEnAttente > 0) return 'attente_accord'
  if (etat.publieAuHub) return 'aide_demandee'
  return 'a_organiser'
}

export const LIBELLE_STATUT: Record<StatutTrajet, string> = {
  annule: 'Annulé',
  a_organiser: 'À organiser',
  je_conduis: 'Je conduis',
  aide_demandee: 'Aide demandée',
  attente_accord: 'En attente d’accord',
  confirme: 'Confirmé',
}
