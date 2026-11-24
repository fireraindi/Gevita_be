# Progress 003: Perbaikan Code Review Poin 2 & Poin 3 pada API Create Overtime

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/32

## Perubahan yang Diterapkan
1. **Poin 2 — Validasi `timeFrame` ([`src/features/overtimes/validation.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/validation.ts)):**
   - Membatasi nilai maksimum `timeFrame` menjadi `24` jam (`"Time frame must not exceed 24 hours"`).
   - Menambahkan pengecekan durasi pada `superRefine` agar `timeFrame * 60` tidak melebihi selisih menit antara `start` dan `end` (`"Time frame must not exceed the duration between start and end time"`).
2. **Poin 3 — Integritas Data User Aktif & Jadwal Overlap ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts) & [`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menolak pembuatan lembur untuk karyawan target yang non-aktif (`users.is_active === false`) dengan `400 Bad Request` (`"Target user is inactive"`).
   - Menolak jadwal lembur yang waktunya bertumpuk (*overlap*) pada `userId` dan `date` yang sama (khusus record aktif dengan `deleted_at IS NULL`, kondisi `existing.start < new.end AND existing.end > new.start`) dengan `409 Conflict` (`"Overtime schedule overlaps with an existing overtime record"`).
   - Menambahkan skema response `409` pada [`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts).
3. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan 3 test case baru untuk validasi `timeFrame > 24` & `timeFrame > durasi`, user target non-aktif (`400`), serta jadwal overlap (`409`), jadwal *back-to-back* (`201`), dan slot yang sebelumnya di-soft delete (`201`).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **11 pass, 0 fail** (78 assertions).
