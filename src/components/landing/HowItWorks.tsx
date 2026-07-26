'use client'

import { useReveal } from '@/hooks/use-reveal'

interface Step {
  step: string
  title: string
  desc: string
}

interface Props {
  t: {
    title: string
    subtitle: string
    steps: ReadonlyArray<Step>
  }
}

export function HowItWorks({ t }: Props) {
  return (
    <section className="relative py-20 sm:py-28 bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 overflow-hidden">
      {/* Glow blobs */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-emerald-400/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">{t.title}</h2>
          <p className="mt-3 text-teal-100/90">{t.subtitle}</p>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-12 left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-transparent via-teal-300/50 to-transparent" />

          {t.steps.map((step, i) => (
            <StepCard key={step.step} step={step} delay={i * 120} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StepCard({ step, delay }: { step: Step; delay: number }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`reveal ${visible ? 'is-visible' : ''} relative text-center`}>
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full bg-cyan-400/30 blur-xl" />
        <div className="relative w-24 h-24 rounded-full bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center">
          <span className="text-2xl font-bold bg-gradient-to-br from-white to-teal-100 bg-clip-text text-transparent">
            {step.step}
          </span>
        </div>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
      <p className="text-sm text-teal-100/80 max-w-xs mx-auto leading-relaxed">{step.desc}</p>
    </div>
  )
}
