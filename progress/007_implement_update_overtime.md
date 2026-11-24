# Progress 007: Implementasi API Update Overtime (`PUT /api/overtimes/:id`)

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/34 ([`issues/update_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/update_overtime_issue.md))

## Ringkasan Implementasi
1. **DTO & Strict Typing (`src/features/overtimes/model/`):**
   - Menambahkan `UpdateOvertimeRequest` pada [`request.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/request.ts) dan `UpdateOvertimeSuccessResponse` pada [`response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts) tanpa `any` maupun `unknown`.
2. **Validasi Zod ([`src/features/overtimes/validation.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/validation.ts)):**
   - Menambahkan `overtimeIdParamSchema` untuk validasi parameter path `id` (integer positif `<= 2_147_483_647`).
   - Menambahkan `updateOvertimeSchema` yang berbagi field dasar dan helper `validateOvertimeSchedule` dengan validasi `start < end`, `end > start`, `start !== end`, format waktu `HH:MM`, tanggal kalender valid `YYYY-MM-DD`, panjang maksimal `description` 1000 karakter, serta kewajiban `timeFrame` sama dengan selisih jam antara `start` dan `end`.
3. **Service Fungsional ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Mengimplementasikan fungsi murni `updateOvertime` dengan pengecekan record aktif (`deleted_at IS NULL`, melempar `NotFoundError("Overtime not found")` jika tidak ditemukan/sudah dihapus).
   - Menambahkan helper bersama `ensureNoOverlappingOvertime` (mengecualikan ID record yang sedang diperbarui menggunakan `ne(overtimes.id, param.id)`) untuk menolak jadwal bertumpuk dengan `409 Conflict`, serta `toOvertimeResponseData` untuk normalisasi waktu `HH:MM`.
4. **Controller ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menambahkan endpoint `PUT /api/overtimes/:id` yang otomatis terlindungi [`activeAdminMiddleware`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/admin.ts), lengkap dengan skema response `200`, `400`, `401`, `403`, `404`, `409`, `500`, serta dokumentasi OpenAPI.
5. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan 6 test case untuk `PUT /api/overtimes/:id` (update sukses, validasi `timeFrame` harus cocok dengan durasi `start`–`end`, validasi `start > end` / `end < start` / `start === end` / tanggal invalid, validasi path param `id` & `404` missing/soft-deleted, `409` overlap vs self-slot update, serta otorisasi admin aktif & JWT).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **18 pass, 0 fail** (141 assertions).
- `bun test`: **172 pass, 0 fail** (770 assertions) di seluruh 6 file pengujian.
