# Progress 008: Perbaikan Code Review Poin 1, 3, dan 4 pada Modul Overtimes

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/34

## Perubahan yang Diterapkan
1. **Poin 1 — Penyeragaman Validasi `timeFrame` ([`src/features/overtimes/validation.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/validation.ts)):**
   - Menyamakan aturan validasi `createOvertimeSchema` (`POST`) dan `updateOvertimeSchema` (`PUT`) melalui `validateOvertimeSchedule` agar keduanya mewajibkan `timeFrame * 60 === durationMinutes` (`"Time frame must match the duration between start and end time"`).
2. **Poin 3 — Transaksi & Advisory Lock Anti *Race Condition* ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Membungkus pengecekan overlap + operasi `INSERT` (`createOvertime`) dan `UPDATE` (`updateOvertime`) di dalam `db.transaction(...)`.
   - Menambahkan helper `lockUserOvertimeDate` menggunakan `pg_advisory_xact_lock(hashtext('overtime:<userId>:<date>'))` agar request paralel pada user dan tanggal yang sama tidak lolos pengecekan overlap secara bersamaan.
3. **Poin 4 — Penambahan Cakupan Test ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan pengujian `timeFrame` lebih kecil dari durasi pada `POST /api/overtimes`.
   - Menambahkan pengujian format waktu invalid (`"25:00"`, `"19:60"`), `description` kosong/whitespace (`"   "`), dan `description` melebihi 1000 karakter pada `PUT /api/overtimes/:id`.

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **18 pass, 0 fail** (150 assertions).
