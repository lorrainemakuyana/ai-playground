import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SDLC Orchestrator',
    short_name: 'Orchestrator',
    description: 'Autonomous AI engineering team for your projects',
    start_url: '/app',
    display: 'standalone',
    background_color: '#0c0a09',
    theme_color: '#7c3aed',
    orientation: 'portrait-primary',
    categories: ['productivity', 'developer-tools'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-384.png',
        sizes: '384x384',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'New Project',
        url: '/app',
        description: 'Create a new AI-powered project',
      },
    ],
  }
}
