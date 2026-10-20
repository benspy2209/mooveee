import { useEffect } from 'react'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { AuthProvider } from '@/lib/auth'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Mooveee',
      },
      {
        name: 'description',
        content: 'Les trajets des enfants, partagés entre familles.',
      },
      // Installation sur l'écran d'accueil : la barre d'état prend la
      // couleur de l'encre du thème, l'application s'ouvre sans la barre
      // d'adresse du navigateur.
      {
        name: 'theme-color',
        content: '#173a40',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Mooveee',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
        sizes: 'any',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/icones/favicon-32.png',
      },
      // iOS ignore le manifeste pour l'icône : il lui faut celle-ci.
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/icones/apple-touch-icon.png',
      },
    ],
  }),
  shellComponent: RootDocument,
})

// Enregistrement du service worker : il ne met rien en cache, il rend
// seulement l'application installable sur l'écran d'accueil (voir
// public/sw.js). En développement, on s'abstient : un worker actif
// brouille le rechargement à chaud de Vite.
function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator)) return
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // Enregistrement refusé (contexte non sécurisé, réglage du
      // navigateur) : l'application fonctionne, elle ne proposera
      // simplement pas l'installation.
    })
  }, [])
}

function RootDocument({ children }: { children: React.ReactNode }) {
  useServiceWorker()

  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
