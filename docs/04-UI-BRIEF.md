# UI/UX Brief : Mooveee

> Reconstitué le 11/10/2026 depuis `src/styles.css`, `src/routes/_authed.tsx`, `src/routes/login.tsx` et le primer (refonte « lagoon » du 15/08/2026). Valeurs exactes du code. [déduit du code] partout, [à confirmer] signalé.

## 1. Intention
- Trois mots : lagon, confiance, pouce (navigation à une main). [déduit du primer : « DA lagoon », réfs BlaBlaCar pour le trajet, Airbnb pour la confiance, iOS 26 Liquid Glass pour le chrome translucide]
- Références retenues : BlaBlaCar (timeline de trajet, vue Semaine étape 3), Airbnb (cartes et badges de confiance), iOS (header et tab bar en verre, `backdrop-filter`).
- Ce qu'on refuse : vocabulaire financier (portefeuille, crédit, débit, prix, coût, achat, dette, solde, gagner, dépenser ; vérifié absent des libellés UI le 11/10), chiffres de contribution visibles par d'autres familles, prénom d'enfant hors du cercle intime, emojis.

## 2. Couleurs (tokens CSS, `src/styles.css`)

| Rôle | Clair | Sombre (`.dark`) |
|------|-------|------------------|
| Fond de page | `--bg-base #e7f3ec` + dégradés radiaux `--hero-a rgba(79,184,178,.36)` / `--hero-b rgba(47,106,74,.2)` | `#0a1418` |
| Surface (cartes `.island-shell`) | `--surface rgba(255,255,255,.74)` → `--surface-strong rgba(255,255,255,.9)` | `rgba(16,30,34,.8)` → `rgba(15,27,31,.92)` |
| Texte principal | `--sea-ink #173a40` | `#d7ece8` |
| Texte secondaire | `--sea-ink-soft #416166` | `#afcdc8` |
| Accent / action | `--lagoon #4fb8b2` → `--lagoon-deep #328f97` (dégradé 150°) | `#60d7cf` → `#8de5db` |
| Accent secondaire (kickers, chips) | `--palm #2f6a4a`, `--kicker rgba(47,106,74,.9)` | `#6ec89a` |
| Lignes | `--line rgba(23,58,64,.14)` | `rgba(141,229,219,.18)` |
| Header / tab bar | `--header-bg rgba(251,255,248,.84)`, blur 14 à 16 px | `rgba(10,20,24,.8)` |
| Succès / Erreur / Alerte / Info | Tailwind `green-50/800`, `red-50/800`, `amber-50/900`, `blue-50/900` (classes utilitaires, pas de tokens) | non déclinés |

Mode sombre : tokens `.dark` complets mais aucun mécanisme ne pose la classe (`@custom-variant dark (&:is(.dark *))`, pas de `prefers-color-scheme`). Donc : non actif aujourd'hui. [à confirmer : suivre le système ou rester clair]

Incohérence : les écrans utilisent encore massivement les gris Tailwind (`text-gray-500/600/700/900`, `bg-amber-50`, `bg-blue-50`) à côté des tokens lagon ; les bannières de rappel dans `_authed.tsx` sont en `amber`/`blue` purs. Palette à unifier.

## 3. Typographie
- Titres et wordmark : Fraunces (variable, opsz 9..144, graisses 500 et 700), classe `.display-title`, `.app-wordmark` (700, `letter-spacing -0.01em`, « eee » en italique `--lagoon-deep`).
- Texte : Manrope 400 à 800, `--font-sans`, taille de base Tailwind 16 px ; corps des écrans majoritairement `text-sm` (14 px) et `text-[11px]` sur la tab bar.
- Kicker : `.island-kicker` 0.69 rem, uppercase, `letter-spacing 0.16em`, 700.
- Échelle utilisée : 11 / 14 / 16 / 18 / 24 / 30 / 36 px (`text-[11px]`, `text-sm`, `text-base`, `text-lg`, `text-2xl`, `text-3xl`, `text-4xl`).
- Chargement : Google Fonts par `@import url(...)`. À auto-héberger avant encapsulation mobile (hors ligne, RGPD). [à confirmer]

## 4. Composants
- Rayon : cartes `rounded-3xl` (24 px), champs et boutons `rounded-md` ou pilule `999px` (`.btn-lagoon`, `.tab-glyph`), `--radius: 0.625rem` shadcn non exploité.
- Espacement : grille Tailwind 4 px ; padding carte `p-6` à `p-8`.
- Boutons : principal `.btn-lagoon` (dégradé lagon, texte blanc, pilule, `py-2.5 text-sm font-semibold`) ; secondaire `.btn-ghost` ; tertiaire lien texte gris. Feedback presse global : `transform: scale(0.97)` 100 ms, relâche 180 ms, `-webkit-tap-highlight-color: transparent`, variante `brightness(0.92)` sous `prefers-reduced-motion`.
- Champs : `.field-lagoon`, `py-3` sur login (hauteur ≈ 44 px), `py-2` sur /bienvenue et formulaires (≈ 38 px, sous la cible tactile 44 pt). [à corriger]
- Cartes : `.island-shell` (dégradé de surface, ombre 22/44 px, `backdrop-filter blur(4px)`, glint intérieur 1 px).
- Avatars : `.avatar-dot` 3 teintes (initiales).
- Bibliothèque : shadcn/ui configuré mais aucun composant installé ; tout est écrit à la main. Icônes lucide-react (`CalendarDays`, `Inbox`, `UsersRound`, `HeartHandshake`, `House`, `Baby`, `CalendarHeart`).
- Modales : une seule, le détail de trajet sur /semaine (centrée, `z-50`, fermeture Escape et clic fond, sans animation ni scroll-lock). Pas de bottom sheet.
- Animations : `.rise-in` 700 ms `cubic-bezier(.16,1,.3,1)`, cascade `.d-1..3` ; réduit à un fondu 400 ms sous `prefers-reduced-motion`. `tw-animate-css` importé mais inutilisé.

## 5. Mise en page et mobile
- Mobile d'abord : oui. Colonne unique, `max-w-lg` à `max-w-5xl` selon l'écran, `.page-wrap` `min(1080px, 100% - 2rem)`.
- Navigation : tab bar fixe en bas, 5 onglets (Semaine, Demandes, Hubs, Équilibre, Foyer), `grid-cols-5 max-w-md`, glyphe 21 px, libellé 11 px, état actif = pastille `--chip-bg` + couleur `--lagoon-deep` + `aria-current="page"`. Enfants et Activités sont atteints depuis Foyer (cartes d'action), pas depuis la barre. Déconnexion : lien texte sur Foyer.
- Header : `sticky top-0 z-40`, verre, wordmark seul, aucun bouton retour.
- Zones sûres : `padding-bottom: env(safe-area-inset-bottom)` sur la tab bar et `calc(92px + env(...))` sous `main`. Manque : `viewport-fit=cover` dans la meta viewport (sinon `env()` vaut 0 en WebView iOS) et `safe-area-inset-top` sous le header. [à corriger]
- Cibles tactiles : boutons principaux ≈ 44 px ; champs formulaires 38 px ; liens « Masquer » des bannières et liens tertiaires en `text-sm` sans padding (hauteur ≈ 20 px). [à corriger]
- Geste retour : aucun gestionnaire ; le bouton système Android fera reculer l'historique du routeur (comportement SPA par défaut). La modale /semaine ne se ferme pas au retour système. [à confirmer]
- Points de rupture : Tailwind par défaut (`sm 640`, `md 768`, `lg 1024`) ; peu de variantes utilisées.
- Scroll : `overflow-x: hidden` sur body ; `scrollRestoration: true` du routeur.

## 6. Ton et micro textes
- Vouvoiement partout (« Entrez votre code d'accès », « Pour terminer votre inscription »).
- Ton : sobre, rassurant, communautaire. Déséquilibre Mooves = message d'aide, jamais de reproche (règle Concierge).
- Exemples relevés : bouton principal « Se connecter », « Continuer », « Recevoir le code de connexion » ; chargement « Chargement… » ; erreur « Une erreur est survenue : {message brut Supabase} » (messages techniques anglais remontés tels quels, à traduire) ; vide « En démarrage » (hub solo), « Places offertes aux autres familles ».
- Vocabulaire imposé (CLAUDE.md) : niveau de contribution, équilibre d'entraide, aide apportée, aide reçue, dynamique de participation.

## 7. Accessibilité
- `<html lang="en">` sur une interface française : à passer en `fr-BE`. [à corriger]
- Contraste : `--sea-ink-soft #416166` sur `--foam #f3faf5` ≈ 6,1:1 (AA ok) ; `text-gray-500` sur surfaces translucides ≈ 4,3:1 (limite AA sur 14 px) ; blanc sur dégradé lagon `#4fb8b2` ≈ 2,3:1 (échec AA pour le texte des boutons principaux). [à confirmer par mesure]
- Focus clavier : aucun style `focus-visible` dédié ; `-webkit-tap-highlight-color` neutralisé. [à corriger]
- `aria-label` sur la nav, `aria-current` sur l'onglet actif, `aria-hidden` sur les icônes : présents. Labels de formulaire associés par `htmlFor` : présents.
- Images : photos d'enfants et de points de rendez-vous, `alt` à vérifier écran par écran. [à confirmer]
- Mouvement : `prefers-reduced-motion` géré sur presse et `.rise-in`.
