-- =====================================================================
-- Cleanup duplicate shift_schedules + add unique constraint
-- =====================================================================
-- Masalah: tanpa UNIQUE constraint di (user_id, date), upsert dengan
-- onConflict:'user_id,date' jatuh ke plain INSERT → setiap klik bikin
-- row baru. Akibatnya tabel numpuk duplicate, query select muat 1000 rows
-- saja (default Supabase), row yang lebih baru nggak ke-load → cell
-- roster keliatan kosong pas refresh.
--
-- Jalankan SQL ini di Supabase Dashboard → SQL Editor (atau psql).
-- Semua aman — idempotent.
-- =====================================================================

-- 1. Lihat dulu berapa banyak duplicate (diagnostic, nggak ubah apa2)
SELECT
  user_id,
  date,
  COUNT(*) AS dup_count
FROM shift_schedules
GROUP BY user_id, date
HAVING COUNT(*) > 1
ORDER BY dup_count DESC
LIMIT 20;

-- 2. Hapus duplicate, simpan yang paling baru (created_at terbesar).
--    Pakai ctid (physical row id) untuk pilih row yang dibuang.
DELETE FROM shift_schedules
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, date
        ORDER BY created_at DESC, ctid DESC
      ) AS rn
    FROM shift_schedules
  ) t
  WHERE rn > 1
);

-- 3. Add unique constraint supaya upsert jalan bener ke depannya.
--    Kalau sudah pernah di-add, ini akan error "already exists" — skip aja.
ALTER TABLE shift_schedules
  ADD CONSTRAINT shift_schedules_user_date_unique
  UNIQUE (user_id, date);

-- 4. Verifikasi: hitung total rows sebelum/sesudah.
--    Expect: jauh lebih sedikit dari sebelumnya.
SELECT COUNT(*) AS total_rows FROM shift_schedules;

SELECT
  DATE_TRUNC('month', date) AS bulan,
  COUNT(*) AS rows
FROM shift_schedules
GROUP BY DATE_TRUNC('month', date)
ORDER BY bulan DESC
LIMIT 6;
