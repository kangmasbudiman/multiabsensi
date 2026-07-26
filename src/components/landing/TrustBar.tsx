'use client'

import { useReveal } from '@/hooks/use-reveal'

interface Props {
  t: { label: string }
}

// Nama perusahaan placeholder — ganti dengan logo asli nanti
const COMPANIES = [
  'PT Maju Jaya',
  'CV Sumber Rejeki',
  'Klinik Sehat',
  'Toko Berkah',
  'PT Bintang Terang',
  'Yayasan Pendidikan',
  'Restoran Nusantara',
  'PT Karya Utama',
]

export function TrustBar({ t }: Props) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <section className="py-12 sm:py-16 bg-white">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div
          ref={ref}
          className={`reveal ${visible ? 'is-visible' : ''} text-center mb-8`}
        >
          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{t.label}</p>
        </div>

        <div className="relative overflow-hidden mask-fade">
          <div className="flex gap-12 animate-marquee whitespace-nowrap">
            {[...COMPANIES, ...COMPANIES].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
              >
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-slate-600">{name[0]}</span>
                </div>
                <span className="text-base font-bold tracking-tight">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .mask-fade {
          mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
        }
      `}</style>
    </section>
  )
}
