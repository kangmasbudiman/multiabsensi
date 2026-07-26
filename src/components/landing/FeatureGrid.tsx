'use client'

import {
  Building2,
  Clock,
  QrCode,
  WifiOff,
  FileText,
  Bell,
  type LucideIcon,
} from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'

interface GridItem {
  icon: string
  title: string
  desc: string
}

interface Props {
  t: {
    title: string
    subtitle: string
    items: ReadonlyArray<GridItem>
  }
}

const ICON_MAP: Record<string, LucideIcon> = {
  building: Building2,
  clock: Clock,
  qr: QrCode,
  wifi: WifiOff,
  file_text: FileText,
  bell: Bell,
}

export function FeatureGrid({ t }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} max-w-2xl mx-auto text-center mb-12`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t.title}</h2>
          <p className="mt-3 text-slate-600">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {t.items.map((item, i) => (
            <FeatureCard key={item.title} icon={item.icon} title={item.title} desc={item.desc} delay={i * 60} />
          ))}
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  const Icon = ICON_MAP[icon] ?? Building2
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'is-visible' : ''} group relative p-6 rounded-2xl bg-white border border-slate-200/70 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden`}
    >
      {/* Hover glow */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-teal-200/0 to-emerald-200/0 group-hover:from-teal-200/40 group-hover:to-emerald-200/40 blur-2xl transition-all" />

      <div className="relative">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/25 mb-4 group-hover:scale-110 transition-transform">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
