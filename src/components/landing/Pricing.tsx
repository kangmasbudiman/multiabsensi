'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, Sparkles } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'

interface Tier {
  name: string
  desc: string
  price_monthly: number
  price_yearly: number
  features: ReadonlyArray<string>
  popular?: boolean
}

interface Props {
  t: {
    title: string
    subtitle: string
    monthly_label: string
    yearly_label: string
    save_label: string
    per_user_label: string
    per_user_yearly_label: string
    billed_yearly_label: string
    popular_badge: string
    cta_free: string
    cta_pro: string
    cta_bisnis: string
    tiers: ReadonlyArray<Tier>
  }
}

export function Pricing({ t }: Props) {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="py-20 sm:py-28 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t.title}</h2>
          <p className="mt-3 text-slate-600">{t.subtitle}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
            <button
              onClick={() => setYearly(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !yearly ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              {t.monthly_label}
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                yearly ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              {t.yearly_label}
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-[9px] font-bold shadow-sm">
                {t.save_label}
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {t.tiers.map((tier, i) => (
            <PricingCard
              key={tier.name}
              tier={tier}
              yearly={yearly}
              t={t}
              delay={i * 100}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function PricingCard({ tier, yearly, t, delay }: { tier: Tier; yearly: boolean; t: Props['t']; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const popular = tier.popular === true
  const price = yearly ? tier.price_yearly : tier.price_monthly
  const cta = tier.name === 'Free' || tier.name === 'Gratis'
    ? t.cta_free
    : popular
      ? t.cta_pro
      : t.cta_bisnis

  const formatted = new Intl.NumberFormat('id-ID').format(price)

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'is-visible' : ''} relative rounded-2xl p-6 sm:p-8 transition-all ${
        popular
          ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl shadow-emerald-950/30 lg:-translate-y-4 ring-2 ring-teal-400'
          : 'bg-white border border-slate-200 text-slate-900 shadow-sm hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-900 text-xs font-bold shadow-lg">
          <Sparkles className="w-3 h-3" />
          {t.popular_badge}
        </div>
      )}

      <div className="mb-5">
        <h3 className={`text-lg font-bold ${popular ? 'text-white' : 'text-slate-900'}`}>{tier.name}</h3>
        <p className={`mt-1 text-sm ${popular ? 'text-slate-300' : 'text-slate-500'}`}>{tier.desc}</p>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        {price === 0 ? (
          <span className={`text-4xl font-bold ${popular ? 'text-white' : 'text-slate-900'}`}>Rp 0</span>
        ) : (
          <>
            <span className={`text-sm font-medium ${popular ? 'text-slate-400' : 'text-slate-500'}`}>Rp</span>
            <span className={`text-4xl font-bold ${popular ? 'text-white' : 'text-slate-900'}`}>{formatted}</span>
          </>
        )}
      </div>
      <div className={`text-xs ${popular ? 'text-slate-400' : 'text-slate-500'}`}>
        {price === 0 ? (
          <span>{popular ? '' : 'selamanya'}</span>
        ) : (
          <>
            {t.per_user_label}
            {yearly && <span className="block mt-0.5">{t.billed_yearly_label}</span>}
          </>
        )}
      </div>

      <Link
        href="/register"
        className={`mt-6 block w-full text-center py-3 rounded-xl font-semibold text-sm transition-all ${
          popular
            ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-slate-900 hover:shadow-lg hover:shadow-teal-500/30'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        }`}
      >
        {cta}
      </Link>

      <ul className="mt-6 space-y-3">
        {tier.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5">
            <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
              popular ? 'bg-teal-400' : 'bg-emerald-100'
            }`}>
              <Check className={`w-2.5 h-2.5 ${popular ? 'text-slate-900' : 'text-emerald-600'}`} strokeWidth={3} />
            </div>
            <span className={`text-sm ${popular ? 'text-slate-200' : 'text-slate-700'}`}>{feat}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
