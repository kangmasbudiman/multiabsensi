import Link from 'next/link'
import { getPlatformName } from '@/lib/platform'

export default async function LandingPage() {
  const appName = await getPlatformName()

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-teal-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">{appName[0]?.toUpperCase()}</span>
          </div>
          <span className="font-bold text-xl text-teal-600">{appName}</span>
        </div>
        <div className="flex gap-3">
          <Link href="/absen" className="px-4 py-2 text-teal-600 font-medium hover:underline">
            Absen Web
          </Link>
          <Link href="/login" className="px-4 py-2 text-teal-600 font-medium hover:underline">
            Masuk
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700"
          >
            Daftar Gratis
          </Link>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-20 text-center">
        <span className="inline-block bg-teal-100 text-teal-700 text-sm font-medium px-3 py-1 rounded-full mb-4">
          HR & Absensi Digital
        </span>
        <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
          Kelola Absensi Karyawan<br />
          <span className="text-teal-600">Lebih Mudah & Akurat</span>
        </h1>
        <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto">
          Sistem absensi berbasis GPS & selfie, manajemen shift, perhitungan gaji otomatis,
          dan anti fake GPS. Semua dalam satu platform.
        </p>

        <div className="flex justify-center gap-4 mb-20">
          <Link
            href="/register"
            className="px-8 py-4 bg-teal-600 text-white rounded-xl font-semibold text-lg hover:bg-teal-700 shadow-lg"
          >
            Daftar Sekarang — Gratis 30 Hari
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 bg-white text-teal-600 rounded-xl font-semibold text-lg border-2 border-teal-200 hover:border-teal-400"
          >
            Login Admin
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="bg-white rounded-xl p-6 text-left shadow-sm">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-sm text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

const features = [
  { icon: '📍', title: 'GPS + Anti Fake', desc: 'Geofencing akurat, deteksi mock GPS otomatis dari device & server' },
  { icon: '🤳', title: 'Absen Selfie', desc: 'Verifikasi wajah saat check-in & check-out, foto tersimpan aman' },
  { icon: '💰', title: 'Payroll Otomatis', desc: 'Hitung gaji, tunjangan, lembur, dan potongan secara otomatis tiap bulan' },
  { icon: '🏢', title: 'Multi Perusahaan', desc: 'Setiap perusahaan punya data & admin panel terpisah dengan kode unik' },
  { icon: '🔄', title: 'Multi Shift', desc: 'Dukung rotasi shift, swap shift, dan toleransi keterlambatan per shift' },
  { icon: '📊', title: 'Laporan Lengkap', desc: 'Dashboard rekap kehadiran, ekspor PDF & Excel untuk payroll' },
]
