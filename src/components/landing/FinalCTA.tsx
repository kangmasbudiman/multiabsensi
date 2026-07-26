'use client'

import Link from 'next/link'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'

interface Props {
  t: {
    title: string
    subtitle: string
    primary_cta: string
    secondary_cta: string
    footnote: string
  }
}

export function FinalCTA({ t }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div
          ref={ref}
          className={`reveal ${visible ? 'is-visible' : ''} relative rounded-3xl overflow-hidden bg-gradient-to-br from-teal-600 via-emerald-700 to-teal-900 px-6 py-16 sm:px-12 sm:py-20 text-center shadow-2xl shadow-emerald-950/30`}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-cyan-400/30 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-emerald-300/30 blur-3xl" />
          <div className="absolute inset-0 bg-grid-pattern opacity-30" />

          <div className="relative max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-xs font-medium mb-5">
              <CalendarClock className="w-3.5 h-3.5" />
              {t.footnote}
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight leading-tight">
              {t.title}
            </h2>
            <p className="mt-4 text-teal-50/90 text-base sm:text-lg">{t.subtitle}</p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white text-teal-700 font-semibold shadow-2xl hover:-translate-y-0.5 transition-all"
              >
                {t.primary_cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="https://wa.me/6281234567890"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/30 text-white font-semibold hover:bg-white/20 transition-all"
              >
                {t.secondary_cta}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
