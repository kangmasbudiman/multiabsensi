export type Lang = 'id' | 'en'

export const LANGS: Lang[] = ['id', 'en']

type DictShape = typeof dict.id
export type Dict = DictShape

export const dict = {
  id: {
    nav: {
      absen_web: 'Absen Web',
      features: 'Fitur',
      pricing: 'Harga',
      faq: 'FAQ',
      login: 'Masuk',
      cta: 'Daftar Gratis',
    },
    hero: {
      badge: 'HR & Absensi Digital #1 di Indonesia',
      title_1: 'Kelola Absensi Karyawan',
      title_highlight: 'Lebih Cepat, Akurat, Anti-Curang',
      subtitle:
        'Sistem absensi berbasis GPS + verifikasi wajah AI. Anti fake GPS, payroll otomatis, dan laporan real-time — semua dalam satu platform.',
      primary_cta: 'Mulai Gratis 30 Hari',
      secondary_cta: 'Lihat Demo',
      no_card_required: 'Tanpa kartu kredit',
      trusted_by: 'Dipercaya oleh 200+ perusahaan',
    },
    trust: {
      label: 'Sudah dipakai oleh tim dari berbagai industri',
    },
    stats: {
      title: 'Angka yang berbicara',
      subtitle: 'Pertumbuhan platform dalam 12 bulan terakhir',
      items: [
        { value: '200+', label: 'Perusahaan aktif' },
        { value: '18K+', label: 'Karyawan terdaftar' },
        { value: '4.2 jt', label: 'Absen diproses / bulan' },
        { value: '99.9%', label: 'Uptime SLA' },
      ],
    },
    features_showcase: {
      title: 'Teknologi yang membuat beda',
      subtitle: 'Bukan sekadar absen online — ini sistem anti-curang yang dirancang untuk bisnis modern.',
      items: [
        {
          tag: 'Geofencing',
          title: 'GPS + Anti Fake GPS',
          desc: 'Absen divalidasi dari lokasi real-time. Mock location dari aplikasi pihak ketiga dideteksi otomatis di level device dan server — karyawan tidak bisa absen dari rumah.',
          points: [
            'Geofencing presisi hingga 50 meter',
            'Deteksi mock GPS di Android & iOS',
            'Log lokasi setiap absen untuk audit',
          ],
          mockup_kind: 'map',
        },
        {
          tag: 'AI Face Recognition',
          title: 'Verifikasi Wajah Saat Absen',
          desc: 'Setiap check-in & check-out diverifikasi dengan wajah karyawan. Foto tersimpan aman, terenkripsi, dan cocok dengan data pendaftaran.',
          points: [
            'Akurasi 99.4% dalam kondisi pencahayaan normal',
            'Foto terenkripsi end-to-end',
            'Fallback PIN & sidik jari kalau wajah gagal',
          ],
          mockup_kind: 'phone',
        },
        {
          tag: 'Payroll Engine',
          title: 'Gaji, Tunjangan & BPJS Otomatis',
          desc: 'Hitung gaji berdasarkan kehadiran real-time. PTKP, BPJS, lembur, dan potongan terkonfigurasi sekali, jalan otomatis setiap bulan.',
          points: [
            'Skema PTKP terbaru (SHEET 2024)',
            'BPJS Kesehatan & Ketenagakerjaan',
            'Export slip gaji PDF massal',
          ],
          mockup_kind: 'payroll',
        },
      ],
    },
    feature_grid: {
      title: 'Semua yang Anda butuhkan, di satu tempat',
      subtitle: 'AbsenKu dirancang untuk skala — dari UKM 5 karyawan hingga enterprise 5000+.',
      items: [
        { icon: 'building', title: 'Multi Perusahaan', desc: 'Setiap cabang punya data, admin, dan kode unik sendiri.' },
        { icon: 'clock', title: 'Rotasi Shift', desc: 'Dukungan multi-shift, swap, dan toleransi terlambat per shift.' },
        { icon: 'qr', title: 'Undang via QR', desc: 'Karyawan daftar sendiri via link/QR — bebas kerja admin.' },
        { icon: 'wifi', title: 'Mode Offline', desc: 'Absen tersimpan lokal saat sinyal hilang, sync otomatis.' },
        { icon: 'file_text', title: 'Laporan PDF & Excel', desc: 'Export rekap kehadiran, gaji, dan insiden dengan 1 klik.' },
        { icon: 'bell', title: 'Notifikasi WA', desc: 'Ingatkan absen masuk/pulang via WhatsApp otomatis.' },
      ],
    },
    how: {
      title: 'Mulai dalam 3 langkah',
      subtitle: 'Onboarding rata-rata 1 hari kerja. Tim Anda siap absen besok pagi.',
      steps: [
        {
          step: '01',
          title: 'Daftar akun perusahaan',
          desc: 'Buat akun, isi nama perusahaan, dan dapatkan kode unik. Gratis 30 hari, tanpa kartu kredit.',
        },
        {
          step: '02',
          title: 'Undang karyawan via QR',
          desc: 'Generate link/QR undangan, kirim ke WhatsApp karyawan. Mereka isi data + foto wajah sendiri.',
        },
        {
          step: '03',
          title: 'Atur shift & mulai absen',
          desc: 'Set shift kerja, jam masuk, geofencing kantor. Karyawan download app dan absen mulai hari yang sama.',
        },
      ],
    },
    pricing: {
      title: 'Harga transparan, tanpa biaya tersembunyi',
      subtitle: 'Pilih paket sesuai skala. Semua paket include GPS + Selfie AI + laporan dasar.',
      monthly_label: 'Bulanan',
      yearly_label: 'Tahunan',
      save_label: 'Hemat 17%',
      per_user_label: '/ user / bulan',
      per_user_yearly_label: '/ user / bulan',
      billed_yearly_label: 'Ditagih per tahun',
      popular_badge: 'Paling Populer',
      cta_free: 'Mulai Gratis',
      cta_pro: 'Coba 30 Hari',
      cta_bisnis: 'Hubungi Sales',
      tiers: [
        {
          name: 'Gratis',
          desc: 'Untuk UKM yang baru mulai digital.',
          price_monthly: 0,
          price_yearly: 0,
          features: [
            'Hingga 5 karyawan',
            'GPS + verifikasi wajah',
            '1 lokasi absen',
            'Laporan dasar PDF',
            'Support komunitas',
          ],
        },
        {
          name: 'Pro',
          desc: 'Untuk perusahaan yang sedang bertumbuh.',
          price_monthly: 25000,
          price_yearly: 21000,
          features: [
            'Karyawan tak terbatas',
            'Payroll otomatis (PTKP/BPJS)',
            'Multi-shift & rotasi',
            'Export Excel + slip gaji',
            'Geofencing multi-lokasi',
            'Notifikasi WhatsApp',
            'Support prioritas (email)',
          ],
          popular: true,
        },
        {
          name: 'Bisnis',
          desc: 'Untuk enterprise & multi-cabang.',
          price_monthly: 50000,
          price_yearly: 42000,
          features: [
            'Semua fitur Pro',
            'Audit log lengkap',
            'SSO & role permission',
            'Custom branding & domain',
            'Dedicated account manager',
            'SLA 99.9% + onsite training',
            'Integrasi HRIS existing',
          ],
        },
      ],
    },
    testimonials: {
      title: 'Apa kata pengguna kami',
      subtitle: 'Lebih dari 200 perusahaan di Indonesia mempercayai AbsenKu untuk absensi harian mereka.',
      items: [
        {
          name: 'Budi Santoso',
          role: 'HR Manager',
          company: 'PT Maju Jaya Abadi',
          avatar_id: 12,
          quote: 'Sebelumnya absen pakai sidik jari, sering antri dan rawan titip absen. Setelah pakai AbsenKu, fake GPS langsung ke-detect. Problemnya selesai.',
        },
        {
          name: 'Siti Rahayu',
          role: 'Operasional Manager',
          company: 'CV Sumber Rejeki',
          avatar_id: 32,
          quote: 'Payroll-nya beneran otomatis. Dulu butuh 2 hari untuk hitung gaji 80 karyawan, sekarang tinggal klik export. Slip PDF langsung ke email masing-masing.',
        },
        {
          name: 'Ahmad Hidayat',
          role: 'Founder',
          company: 'Klinik Sehat Bersama',
          avatar_id: 47,
          quote: 'Yang kami suka undang via QR — tinggal kirim ke grup WA, karyawan isi sendiri. Onboarding 10 perawat baru selesai dalam 1 jam.',
        },
      ],
    },
    faq: {
      title: 'Pertanyaan yang sering diajukan',
      subtitle: 'Tidak menemukan jawaban? Tim kami siap bantu via WhatsApp.',
      contact_cta: 'Chat WhatsApp',
      items: [
        {
          q: 'Apakah data absensi & foto wajah aman?',
          a: 'Semua data disimpan di server Indonesia dengan enkripsi AES-256. Foto wajah terenkripsi end-to-end dan tidak pernah dibagikan ke pihak ketiga. Backup harian dengan retensi 30 hari.',
        },
        {
          q: 'Bagaimana kalau karyawan absen di area tanpa sinyal?',
          a: 'Mode offline menyimpan absen di perangkat dan sinkron otomatis begitu sinyal kembali. Absen tetap valid selama lokasi & wajah tercatat — sistem akan beri tanda "pending sync" di dashboard admin.',
        },
        {
          q: 'Apakah bisa dicoba dulu sebelum bayar?',
          a: 'Ya. Paket Gratis tersedia untuk hingga 5 karyawan tanpa batas waktu. Untuk fitur Pro, tersedia uji coba 30 hari tanpa kartu kredit — cukup daftar dan langsung aktif.',
        },
        {
          q: 'Apakah payroll mendukung skema PTKP, BPJS, dan THR?',
          a: 'Ya. Engine payroll kami mengikuti regulasi terbaru: PTKP SHEET 2024, BPJS Kesehatan & Ketenagakerjaan, serta perhitungan THR otomatis berdasarkan masa kerja. Skema bisa dikustom per perusahaan.',
        },
        {
          q: 'Berapa lama proses implementasi?',
          a: 'Rata-rata 1 hari kerja untuk onboarding lengkap: setup akun, import data karyawan, training admin via video call. Karyawan bisa mulai absen di hari yang sama setelah download aplikasi.',
        },
        {
          q: 'Apakah bisa custom branding (logo, warna, domain)?',
          a: 'Tersedia di paket Bisnis. Anda bisa custom logo aplikasi, skema warna, dan menggunakan domain sendiri (misal: absen.perusahaananda.com). Onboarding custom branding butuh 3-5 hari kerja.',
        },
      ],
    },
    final_cta: {
      title: 'Siap mengakhiri absensi yang ribet?',
      subtitle: 'Bergabung dengan 200+ perusahaan yang sudah menghemat 20+ jam/bulan dengan AbsenKu.',
      primary_cta: 'Mulai Gratis Sekarang',
      secondary_cta: 'Jadwal Demo',
      footnote: 'Gratis 30 hari • Tanpa kartu kredit • Setup 5 menit',
    },
    footer: {
      tagline: 'Sistem absensi digital terpercaya untuk bisnis Indonesia.',
      columns: [
        {
          title: 'Produk',
          links: ['Fitur', 'Harga', 'Keamanan', 'Roadmap', 'Status'],
        },
        {
          title: 'Perusahaan',
          links: ['Tentang Kami', 'Blog', 'Karir', 'Press Kit', 'Kontak'],
        },
        {
          title: 'Sumber Daya',
          links: ['Dokumentasi', 'Panduan HR', 'API Developer', 'Komunitas', 'Webinar'],
        },
        {
          title: 'Legal',
          links: ['Kebijakan Privasi', 'Syarat Layanan', 'Cookie', 'DPA', 'Slip Gaji'],
        },
      ],
      copyright: '© 2026 AbsenKu. Semua hak dilindungi.',
      made_in: 'Dibuat dengan ❤ di Jakarta',
    },
  },

  en: {
    nav: {
      absen_web: 'Web Check-in',
      features: 'Features',
      pricing: 'Pricing',
      faq: 'FAQ',
      login: 'Log in',
      cta: 'Sign up free',
    },
    hero: {
      badge: '#1 Digital HR & Attendance in Indonesia',
      title_1: 'Manage Employee Attendance',
      title_highlight: 'Faster, Accurate, Cheat-Proof',
      subtitle:
        'GPS-based attendance with AI face verification. Anti fake GPS, automated payroll, real-time reports — all in one platform.',
      primary_cta: 'Start Free — 30 Days',
      secondary_cta: 'See Demo',
      no_card_required: 'No credit card required',
      trusted_by: 'Trusted by 200+ companies',
    },
    trust: {
      label: 'Used by teams across industries',
    },
    stats: {
      title: 'Numbers that speak',
      subtitle: 'Platform growth in the last 12 months',
      items: [
        { value: '200+', label: 'Active companies' },
        { value: '18K+', label: 'Registered employees' },
        { value: '4.2M', label: 'Check-ins processed / month' },
        { value: '99.9%', label: 'Uptime SLA' },
      ],
    },
    features_showcase: {
      title: 'The tech that makes the difference',
      subtitle: 'Not just another attendance app — this is a cheat-proof system built for modern businesses.',
      items: [
        {
          tag: 'Geofencing',
          title: 'GPS + Anti Fake GPS',
          desc: 'Every check-in validated against real-time location. Mock location apps detected at device & server level — employees cannot check in from home.',
          points: [
            'Geofencing precision within 50 meters',
            'Detects mock GPS on Android & iOS',
            'Per-check-in location log for audit',
          ],
          mockup_kind: 'map',
        },
        {
          tag: 'AI Face Recognition',
          title: 'Face Verification on Every Check-in',
          desc: 'Every check-in & check-out is matched against the employee\'s registered face. Photos are encrypted end-to-end and stored securely.',
          points: [
            '99.4% accuracy in normal lighting',
            'End-to-end encrypted photos',
            'PIN & fingerprint fallback when face fails',
          ],
          mockup_kind: 'phone',
        },
        {
          tag: 'Payroll Engine',
          title: 'Automated Salary, Benefits & Taxes',
          desc: 'Payroll calculated from real-time attendance. PTKP, BPJS, overtime, deductions configured once — runs automatically every month.',
          points: [
            'Latest Indonesian PTKP scheme',
            'BPJS Health & Employment integrated',
            'Bulk PDF payslip export',
          ],
          mockup_kind: 'payroll',
        },
      ],
    },
    feature_grid: {
      title: 'Everything you need, in one place',
      subtitle: 'Built to scale — from 5-employee SMEs to 5,000+ enterprises.',
      items: [
        { icon: 'building', title: 'Multi-Company', desc: 'Each branch has its own data, admin, and unique code.' },
        { icon: 'clock', title: 'Shift Rotation', desc: 'Multi-shift, swaps, and per-shift late tolerance.' },
        { icon: 'qr', title: 'Invite via QR', desc: 'Employees self-register via link/QR — admin stays hands-free.' },
        { icon: 'wifi', title: 'Offline Mode', desc: 'Check-in saved locally on signal loss, auto-syncs.' },
        { icon: 'file_text', title: 'PDF & Excel Reports', desc: 'Export attendance, payroll, incidents with one click.' },
        { icon: 'bell', title: 'WhatsApp Alerts', desc: 'Auto-remind check-in/out via WhatsApp.' },
      ],
    },
    how: {
      title: 'Get started in 3 steps',
      subtitle: 'Average onboarding is 1 business day. Your team is ready to check in tomorrow morning.',
      steps: [
        {
          step: '01',
          title: 'Register your company',
          desc: 'Create account, fill in company name, get unique code. Free for 30 days, no credit card required.',
        },
        {
          step: '02',
          title: 'Invite employees via QR',
          desc: 'Generate invite link/QR, send via WhatsApp. Employees fill in their data + face photo themselves.',
        },
        {
          step: '03',
          title: 'Configure shifts & go live',
          desc: 'Set work shifts, check-in times, office geofence. Employees download the app and check in the same day.',
        },
      ],
    },
    pricing: {
      title: 'Transparent pricing, no hidden fees',
      subtitle: 'Choose a plan that fits your scale. All plans include GPS + AI Selfie + basic reports.',
      monthly_label: 'Monthly',
      yearly_label: 'Yearly',
      save_label: 'Save 17%',
      per_user_label: '/ user / month',
      per_user_yearly_label: '/ user / month',
      billed_yearly_label: 'Billed annually',
      popular_badge: 'Most Popular',
      cta_free: 'Start Free',
      cta_pro: 'Try 30 Days',
      cta_bisnis: 'Contact Sales',
      tiers: [
        {
          name: 'Free',
          desc: 'For SMEs just going digital.',
          price_monthly: 0,
          price_yearly: 0,
          features: [
            'Up to 5 employees',
            'GPS + face verification',
            '1 attendance location',
            'Basic PDF reports',
            'Community support',
          ],
        },
        {
          name: 'Pro',
          desc: 'For growing companies.',
          price_monthly: 25000,
          price_yearly: 21000,
          features: [
            'Unlimited employees',
            'Automated payroll (PTKP/BPJS)',
            'Multi-shift & rotation',
            'Excel export + payslips',
            'Multi-location geofencing',
            'WhatsApp notifications',
            'Priority email support',
          ],
          popular: true,
        },
        {
          name: 'Business',
          desc: 'For enterprise & multi-branch.',
          price_monthly: 50000,
          price_yearly: 42000,
          features: [
            'All Pro features',
            'Full audit log',
            'SSO & role permissions',
            'Custom branding & domain',
            'Dedicated account manager',
            '99.9% SLA + onsite training',
            'HRIS integrations',
          ],
        },
      ],
    },
    testimonials: {
      title: 'What our users say',
      subtitle: 'Over 200 companies in Indonesia trust AbsenKu for their daily attendance.',
      items: [
        {
          name: 'Budi Santoso',
          role: 'HR Manager',
          company: 'PT Maju Jaya Abadi',
          avatar_id: 12,
          quote: 'Before, we used fingerprint — long queues, prone to buddy punching. After AbsenKu, fake GPS is caught instantly. Problem solved.',
        },
        {
          name: 'Siti Rahayu',
          role: 'Operations Manager',
          company: 'CV Sumber Rejeki',
          avatar_id: 32,
          quote: 'Payroll is truly automated. It used to take 2 days for 80 employees, now it\'s one click. PDF payslip straight to each inbox.',
        },
        {
          name: 'Ahmad Hidayat',
          role: 'Founder',
          company: 'Klinik Sehat Bersama',
          avatar_id: 47,
          quote: 'We love the QR invite — just send to the WA group, employees fill it in themselves. Onboarding 10 new nurses in 1 hour.',
        },
      ],
    },
    faq: {
      title: 'Frequently asked questions',
      subtitle: 'Don\'t see an answer? Our team is ready to help via WhatsApp.',
      contact_cta: 'Chat on WhatsApp',
      items: [
        {
          q: 'Is my attendance & face data secure?',
          a: 'All data is stored on Indonesian servers with AES-256 encryption. Face photos are end-to-end encrypted and never shared with third parties. Daily backups with 30-day retention.',
        },
        {
          q: 'What if an employee checks in with no signal?',
          a: 'Offline mode saves the check-in on the device and auto-syncs once signal returns. The check-in remains valid as long as location & face are recorded — marked "pending sync" in the admin dashboard.',
        },
        {
          q: 'Can I try before paying?',
          a: 'Yes. The Free plan covers up to 5 employees with no time limit. For Pro features, a 30-day trial is available with no credit card — just sign up and go.',
        },
        {
          q: 'Does payroll support PTKP, BPJS, and THR?',
          a: 'Yes. Our payroll engine follows the latest regulations: PTKP 2024 scheme, BPJS Health & Employment, and automated THR based on tenure. Schemes are customizable per company.',
        },
        {
          q: 'How long is implementation?',
          a: 'Average 1 business day for full onboarding: account setup, employee data import, admin training via video call. Employees can start checking in the same day after downloading the app.',
        },
        {
          q: 'Can I custom-brand (logo, color, domain)?',
          a: 'Available on the Business plan. Custom logo, color scheme, and your own domain (e.g.: attendance.yourcompany.com). Custom branding onboarding takes 3-5 business days.',
        },
      ],
    },
    final_cta: {
      title: 'Ready to end attendance headaches?',
      subtitle: 'Join 200+ companies already saving 20+ hours/month with AbsenKu.',
      primary_cta: 'Start Free Now',
      secondary_cta: 'Schedule a Demo',
      footnote: 'Free for 30 days • No credit card • 5-minute setup',
    },
    footer: {
      tagline: 'Trusted digital attendance for Indonesian businesses.',
      columns: [
        {
          title: 'Product',
          links: ['Features', 'Pricing', 'Security', 'Roadmap', 'Status'],
        },
        {
          title: 'Company',
          links: ['About', 'Blog', 'Careers', 'Press Kit', 'Contact'],
        },
        {
          title: 'Resources',
          links: ['Documentation', 'HR Guide', 'Developer API', 'Community', 'Webinars'],
        },
        {
          title: 'Legal',
          links: ['Privacy Policy', 'Terms of Service', 'Cookies', 'DPA', 'Payslips'],
        },
      ],
      copyright: '© 2026 AbsenKu. All rights reserved.',
      made_in: 'Made with ❤ in Jakarta',
    },
  },
} as const
