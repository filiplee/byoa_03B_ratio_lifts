import { useEffect } from 'react'

type SeoConfig = {
  title: string
  description: string
  canonicalUrl: string
  ogImageUrl: string
  jsonLd?: unknown
}

const upsertMeta = (id: string, attrs: Record<string, string>) => {
  let el = document.getElementById(id) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.id = id
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}

const upsertLink = (id: string, attrs: Record<string, string>) => {
  let el = document.getElementById(id) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.id = id
    document.head.appendChild(el)
  }
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
}

const upsertJsonLd = (id: string, jsonLd: unknown | undefined) => {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (!jsonLd) {
    existing?.remove()
    return
  }

  let el = existing
  if (!el) {
    el = document.createElement('script')
    el.id = id
    el.type = 'application/ld+json'
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(jsonLd)
}

export function Seo({ config }: { config: SeoConfig }) {
  useEffect(() => {
    document.title = config.title

    upsertMeta('seo-robots', { name: 'robots', content: 'index,follow' })

    upsertMeta('seo-description', { name: 'description', content: config.description })
    upsertLink('seo-canonical', { rel: 'canonical', href: config.canonicalUrl })

    // Open Graph
    upsertMeta('seo-og-type', { property: 'og:type', content: 'website' })
    upsertMeta('seo-og-title', { property: 'og:title', content: config.title })
    upsertMeta('seo-og-description', { property: 'og:description', content: config.description })
    upsertMeta('seo-og-url', { property: 'og:url', content: config.canonicalUrl })
    upsertMeta('seo-og-image', { property: 'og:image', content: config.ogImageUrl })
    upsertMeta('seo-og-image-width', { property: 'og:image:width', content: '1200' })
    upsertMeta('seo-og-image-height', { property: 'og:image:height', content: '630' })

    // Twitter cards
    upsertMeta('seo-twitter-card', { name: 'twitter:card', content: 'summary_large_image' })
    upsertMeta('seo-twitter-title', { name: 'twitter:title', content: config.title })
    upsertMeta('seo-twitter-description', { name: 'twitter:description', content: config.description })
    upsertMeta('seo-twitter-image', { name: 'twitter:image', content: config.ogImageUrl })

    // JSON-LD (page-specific)
    upsertJsonLd('seo-jsonld-howto', config.jsonLd)
  }, [config])

  return null
}

