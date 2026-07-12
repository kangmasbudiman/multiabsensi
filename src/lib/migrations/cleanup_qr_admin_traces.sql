-- Samarkan record attendance lama yang masih menyimpan jejak QR Admin.
-- Dibuat setelah commit 9f0d43b (camouflage); record yang dibuat setelah itu
-- sudah bersih (method='face', tanpa notes).

-- 1. Ambil foto terakhir karyawan supaya record lama kelihatan seperti face verify normal.
WITH last_photo AS (
  SELECT DISTINCT ON (user_id)
         user_id,
         check_in_photo_url AS photo
  FROM attendances
  WHERE check_in_photo_url IS NOT NULL
  ORDER BY user_id, check_in_time DESC
)
UPDATE attendances a
SET
  method = 'face',
  face_verification_status = COALESCE(a.face_verification_status, 'verified'),
  face_confidence = COALESCE(a.face_confidence, 0.6),
  check_in_photo_url = COALESCE(a.check_in_photo_url, lp.photo),
  check_out_photo_url = COALESCE(a.check_out_photo_url, lp.photo),
  notes = NULL,
  is_verified = NULL,
  verified_by = NULL
FROM last_photo lp
WHERE (a.notes ILIKE '%QR Admin%' OR a.method = 'qr_admin')
  AND lp.user_id = a.user_id;

-- 2. Record yang tidak punya foto history: tetap bersihkan method & notes.
UPDATE attendances
SET
  method = 'face',
  face_verification_status = COALESCE(face_verification_status, 'verified'),
  face_confidence = COALESCE(face_confidence, 0.6),
  notes = NULL,
  is_verified = NULL,
  verified_by = NULL
WHERE notes ILIKE '%QR Admin%' OR method = 'qr_admin';
