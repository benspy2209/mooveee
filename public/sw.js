// Service worker minimal — installabilité seulement, AUCUN cache.
//
// Chrome ne propose « Installer l'application » que si un service worker
// gère l'événement fetch. Celui-ci se contente de laisser passer les
// requêtes : rien n'est mis en cache, délibérément.
//
// Pourquoi aucun cache : l'application affiche des trajets d'enfants,
// des demandes en attente et des membres de hub. Servir une version
// périmée de ces écrans serait pire que ne rien afficher — un parent
// pourrait croire qu'une place est libre alors qu'elle ne l'est plus.
// Le mode hors ligne, s'il est voulu un jour, demandera une décision
// explicite sur ce qui peut être conservé sur l'appareil, et un passage
// par l'analyse de protection des données.
//
// skipWaiting + clients.claim : une nouvelle version remplace
// immédiatement l'ancienne, pour ne jamais laisser un ancien worker
// décider du comportement.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Pas de respondWith : le navigateur fait sa requête réseau normale.
})
