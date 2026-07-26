'use client'

import { Quote, Star } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'

interface Item {
  name: string
  role: string
  company: string
  avatar_id: number
  quote: string
}

interface Props {
  t: {
    title: string
    subtitle: string
    items: ReadonlyArray<Item>
  }
}

export function Testimonials({ t }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div ref={ref} className={`reveal ${visible ? 'is-visible' : ''} max-w-2xl mx-auto text-center mb-14`}>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">{t.title}</h2>
          <p className="mt-3 text-slate-600">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {t.items.map((item, i) => (
            <TestimonialCard key={item.name} item={item} delay={i * 100} />
          ))}
        </div>
      </div>
    </section>
  )
}

function TestimonialCard({ item, delay }: { item: Item; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`reveal ${visible ? 'is-visible' : ''} relative p-6 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/70 shadow-sm hover:shadow-md transition-all`}
    >
      <Quote className="absolute top-5 right-5 w-8 h-8 text-teal-100" fill="currentColor" />

      <div className="relative">
        {/* Stars */}
        <div className="flex gap-0.5 mb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
          ))}
        </div>

        {/* Quote */}
        <p className="text-sm text-slate-700 leading-relaxed mb-5">
          &ldquo;{item.quote}&rdquo;
        </p>

        {/* Author */}
        <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
          <img
            src={`https://i.pravatar.cc/80?img=${item.avatar_id}`}
            alt={item.name}
            width={40}
            height={40}
            loading="lazy"
            className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow"
          />
          <div>
            <div className="font-semibold text-slate-900 text-sm">{item.name}</div>
            <div className="text-xs text-slate-500">
              {item.role} · <span className="text-teal-600">{item.company}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
