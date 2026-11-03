# Vers la version pilote — évaluation du 3 novembre 2026

Réponse à la demande de Stéphane du 3/11 : aller le plus loin possible
vers l'expérience finale avant le pilote, et dire si c'est tenable deux
semaines avant les vacances de Noël, ou à Noël.

La réponse courte : **deux semaines avant les vacances, non, pas pour
tout. Une démonstration complète le vendredi 11 décembre, oui. La carte
et les notifications sur téléphone le mardi 22 décembre, oui. La voix,
non — et la raison n'est pas le temps.**

Le reste de ce document dit pourquoi, chiffre par chiffre.

---

## 1. Ce que la demande ajoute à l'état du 30 octobre

Le tableau du 30/10 listait neuf chantiers avant pilote, estimés à
trois semaines. La demande du 3/11 en ajoute cinq :

| Ajout du 3/11 | Travail | Dans l'état du 30/10 ? |
| --- | --- | --- |
| Le calendrier comme point de départ | 4 jours | Partiellement (vues Jour et Mois) |
| Le design des planches : pictogrammes, repères, récapitulatifs | 6 à 8 jours | Non — la passe du 30/10 ne corrigeait que des défauts |
| Liste **ou** carte, épingles ouvrant les trajets | 4 jours | Non |
| Demande vocale préparant le formulaire | 3 à 8 jours selon le chemin | Non |
| Gestion des imprévus de bout en bout | 3 jours | Non |
| Jeu de données fictives pour la démonstration | 2 jours | Non |

Total ajouté : 22 à 29 jours. Total général : **37 à 48 jours de
travail**, hors DPIA.

## 2. Ce que cela donne en dates

Un calcul honnête demande une hypothèse honnête sur le rythme. Je
travaille sur Mooveee **quatre jours par semaine** dans ce calcul. Si
c'est trois, tout glisse de deux semaines ; si c'est cinq, d'une semaine
en avance. C'est le seul chiffre de ce document que je ne contrôle pas
seul, et c'est à Ben de le confirmer.

Du 4 novembre au 11 décembre : 22 jours ouvrés travaillés.
Du 4 novembre au 22 décembre : 28 jours ouvrés travaillés (le 11 novembre
est férié).

Les 37 à 48 jours ne rentrent donc pas avant Noël. Il faut découper.

### Étape 1 — Vendredi 11 décembre : la démonstration

Un lien, des données fictives, deux familles et un club complets.
Destiné aux deux responsables de club, pas encore aux parents.

Contenu livré à cette date :

- **Le calendrier d'abord.** Vue Jour, Semaine, Mois. L'application
  s'ouvre dessus. Une activité, son aller et son retour se lisent d'un
  coup d'œil, avec les heures réelles de départ et d'arrivée.
- **Le design des planches** sur les huit écrans : pictogrammes,
  repères visuels, récapitulatifs. Une grammaire unique, pas huit
  écrans qui se ressemblent vaguement.
- **Le parcours complet** : je cherche, je propose, on échange, on
  s'accorde, je suis prévenu, le trajet a lieu, la remise est
  confirmée. Y compris les imprévus : annulation tardive, conducteur
  qui se désiste, place qui se libère.
- **Les notifications par e-mail**, avec leurs préférences et leurs
  heures de silence.
- **Les corrections déjà identifiées** : l'aller-retour qui forme un
  seul besoin, l'écran de signalement, l'invitation du deuxième adulte
  qui part enfin, la remise qui ne se confirme pas avant le trajet
  (déjà faite le 30/10).
- **Le tutoriel dans l'application.**

### Étape 2 — Mardi 22 décembre : carte et téléphone

- **La carte** avec le basculement liste/carte et les épingles.
- **Les notifications sur le téléphone** (voir § 4 pour l'iPhone).
- Les retours des deux responsables, récoltés entre le 11 et le 19.

### Étape 3 — Janvier : l'ouverture aux familles

Elle ne dépend plus de moi. Elle dépend de la DPIA. Je peux livrer le
22 décembre une application prête ; elle ne doit pas recevoir une vraie
famille tant que la juriste n'a pas rendu son avis.

C'est exactement le découpage en deux étapes que Stéphane propose
lui-même, et c'est le bon : la démonstration avec des données fictives
ne traite aucune donnée d'enfant, donc rien ne la bloque.

---

## 3. La carte — ce qui est réutilisable, ce qui manque

**Déjà là, et c'est beaucoup :**

- Les coordonnées sont en base depuis le chantier v4. Cinq lieux sur
  cinq sont géolocalisés, 209 trajets sur 339 sont rattachés à un lieu.
- La recherche d'adresse fonctionne (Photon, sur OpenStreetMap,
  serveurs européens, sans clé ni compte).
- Le filtre de ce qui a le droit d'être vu côté hub existe déjà
  (`hub_trips_view`). **La carte n'ouvre aucun canal de données
  nouveau** : elle affiche sur un fond de plan exactement ce que la
  liste affiche déjà en texte.
- La règle « un lieu, jamais un domicile » est posée et tenue depuis
  le début. Le domicile reste le mot « Domicile » et un code postal
  flou. Il n'y aura jamais d'épingle sur une maison.

**À intégrer :**

- Une bibliothèque de carte (MapLibre, libre) et le basculement
  liste/carte, les épingles groupées quand deux trajets partent du
  même endroit, la fiche qui s'ouvre sous l'épingle.
- **Un fournisseur de fond de carte.** C'est la seule vraie dépendance
  externe. Les serveurs « standard » d'OpenStreetMap interdisent
  l'usage en production. Il faut soit un fournisseur (gratuit jusqu'à
  un volume très supérieur au pilote, payant ensuite), soit héberger
  le fond nous-mêmes. Décision à prendre, coût nul au pilote.
- Une ligne de plus dans la DPIA : afficher une carte envoie au
  fournisseur de tuiles la zone regardée. Aucune donnée d'enfant, mais
  c'est un transfert, donc il se déclare.

**Délai réel : 4 jours**, dont un pour le fournisseur de tuiles.
C'est inclus dans l'étape 2.

## 4. La voix — le temps n'est pas le problème

**Réutilisable aujourd'hui : rien. Pas une ligne.**

Trois chemins possibles, et ils ne se valent pas :

**a) La dictée du navigateur** (Web Speech API) — 2 à 3 jours. Mais sur
un téléphone Android l'audio part chez Google, sur un iPhone chez
Apple. Si un parent dit « je dois emmener Léo au tennis mardi », le
prénom de son enfant part chez un tiers. C'est l'interdit n° 7 de ce
projet, et on ne peut pas le contourner par un avertissement : on ne
contrôle pas ce qu'un parent prononce.

**b) La reconnaissance locale**, dans le téléphone, rien qui sorte
(Whisper en WebAssembly) — 6 à 8 jours. Aucun interdit touché, parce
qu'aucun transfert. En contrepartie : 40 à 75 Mo à télécharger au
premier usage, et une qualité correcte en français mais pas garantie
sur un téléphone de cinq ans.

**c) Pas de voix au pilote**, et à la place un formulaire plus court,
qui devine l'activité et l'horaire depuis le calendrier — 1 jour.

Ma recommandation : **(c) pour le pilote, (b) juste après**, et la
question posée telle quelle à la juriste. Si elle estime que
l'avertissement suffit, (a) devient possible et tient en trois jours.
Je ne veux pas trancher à sa place un point qui porte sur la voix d'un
parent parlant de son enfant.

Autrement dit : la voix ne décale pas le 22 décembre. Elle n'y est
simplement pas, pour une raison qui n'est pas le calendrier.

## 5. Ce qui reste après, et c'est assumé

- L'application dans l'App Store (compte développeur Apple, délai de
  validation). Au pilote, l'iPhone reçoit les notifications **à
  condition que le parent ait ajouté l'application à son écran
  d'accueil** — c'est une étape du tutoriel, pas une limite technique.
- Les écrans pour l'institution, la certification, la facturation.
- Le défraiement des bénévoles, qui attend sa validation juridique.
- La garde alternée, sauf si une famille des deux clubs est concernée.
- Le néerlandais.

## 6. Ce qui ferait tomber ces dates

Je préfère les nommer maintenant plutôt que le 10 décembre.

1. **Le rythme de travail réel.** Tout le calcul tient sur quatre jours
   par semaine. C'est l'hypothèse la plus fragile du document.
2. **Les planches.** Si je reçois les pictogrammes en fichiers, la
   passe de design dure six jours. Si je dois les redessiner, huit, et
   ils ne seront pas identiques aux planches. Question posée au § 7.
3. **Les retours des deux responsables.** S'ils arrivent le 20, ils ne
   sont pas dans la version du 22.
4. **La DPIA.** Elle ne décale pas les livraisons, elle décale
   l'ouverture aux familles. Si elle traîne, les clubs auront une
   application prête qu'ils ne pourront pas ouvrir, et c'est le pire
   des scénarios pour leur motivation.

## 7. Les quatre décisions qu'il me faut maintenant

Les quatre, avant le 10 novembre, sinon l'étape 1 glisse.

1. **Les pictogrammes des planches** : puis-je recevoir les fichiers
   sources, ou dois-je m'en approcher avec une bibliothèque d'icônes ?
2. **La voix** : chemin (c) pour le pilote, comme je le recommande, ou
   la question part d'abord à la juriste ?
3. **La DPIA** : quel prestataire, quelle date de rendu. C'est la
   seule chose qui sépare une démonstration d'un pilote.
4. **Les deux clubs** : combien de familles chacun, et quelle activité
   type. Le jeu de données fictives doit leur ressembler, sinon la
   démonstration ne leur parle pas.

Restent ouvertes, moins urgentes, les quatre du 30 octobre :
les événements qui déclenchent une notification, la forme de la
discussion entre parents, le calcul de la distance, et le message
adressé à une famille en bas de l'équilibre.
