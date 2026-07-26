'use client'

import { useReveal } from '@/hooks/use-reveal'

interface Props {
  t: {
    title: string
    subtitle: string
    items: ReadonlyArray<{ value: string; label: string }>
  }
}

export function StatsSection({ t }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="relative py-20 sm:py-28 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div
          ref={ref}
          className={`reveal ${visible ? 'is-visible' : ''} max-w-2xl mx-auto text-center mb-12`}
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
            {t.title}
          </h2>
          <p className="mt-3 text-slate-600">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {t.items.map((item, i) => (
            <StatsCard key={item.label} value={item.value} label={item.label} delay={i * 80} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatsCard({ value, label, delay }: { value: string; label: string; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'is-visible' : ''} relative p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/70 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
    >
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 opacity-80" />
      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-teal-600 to-emerald-600 bg-clip-text text-transparent">
        {value}
      </div>
      <div className="mt-1 text-sm text-slate-600">{label}</div>
    </div>
  )
}
