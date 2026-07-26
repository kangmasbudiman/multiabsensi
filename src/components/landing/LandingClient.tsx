'use client'

import { useCallback, useEffect, useState } from 'react'
import { dict, type Lang } from '@/lib/i18n/landing-dict'
import { Navbar } from './Navbar'
import { Hero } from './Hero'
import { TrustBar } from './TrustBar'
import { StatsSection } from './StatsSection'
import { FeaturesShowcase } from './FeaturesShowcase'
import { FeatureGrid } from './FeatureGrid'
import { HowItWorks } from './HowItWorks'
import { Pricing } from './Pricing'
import { Testimonials } from './Testimonials'
import { FAQ } from './FAQ'
import { FinalCTA } from './FinalCTA'
import { Footer } from './Footer'

interface Props {
  appName: string
  initialLang: Lang
}

export function LandingClient({ appName, initialLang }: Props) {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = dict[lang]

  // Keep <html lang="..."> in sync for a11y / SEO
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang
    }
  }, [lang])

  // Smooth-scroll for anchor links (#features, #pricing, etc)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a[href^="#"]') as HTMLAnchorElement | null
      if (!anchor) return
      const id = anchor.getAttribute('href')?.slice(1)
      if (!id) return
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'id' ? 'en' : 'id'
      // Persist via cookie — server reads this on next load for SSR.
      document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">
      <Navbar t={t.nav} appName={appName} lang={lang} onToggleLang={toggleLang} />
      <main>
        <Hero t={t.hero} appName={appName} />
        <TrustBar t={t.trust} />
        <StatsSection t={t.stats} />
        <FeaturesShowcase t={t.features_showcase} />
        <FeatureGrid t={t.feature_grid} />
        <HowItWorks t={t.how} />
        <Pricing t={t.pricing} />
        <Testimonials t={t.testimonials} />
        <FAQ t={t.faq} />
        <FinalCTA t={t.final_cta} />
      </main>
      <Footer t={t.footer} appName={appName} />
    </div>
  )
}
