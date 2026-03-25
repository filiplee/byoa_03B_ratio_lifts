/**
 * Analytics events for form start, form complete, and PDF export.
 * Wire to PostHog, GA4, or other provider via environment.
 * (Coach-phase events such as load/save athlete are reserved for a later release.)
 */

type EventName = 'form_start' | 'form_complete' | 'pdf_export'

export function trackEvent(event: EventName, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    // PostHog: window.posthog?.capture(event, properties)
    // GA4: window.gtag?.('event', event, properties)
    if (import.meta.env.DEV) {
      console.log('[analytics]', event, properties)
    }
  } catch {
    // no-op
  }
}
