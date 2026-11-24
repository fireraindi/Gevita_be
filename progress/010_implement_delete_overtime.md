# Progress 010: Implementasi API Soft Delete Overtime (`DELETE /api/overtimes/:id`)

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/36 ([`issues/delete_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/delete_overtime_issue.md))

## Ringkasan Implementasi
1. **Model Response DTO ([`src/features/overtimes/model/response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts)):**
   - Menambahkan `DeleteOvertimeSuccessResponse` tanpa penggunaan `any` maupun `unknown`.
2. **Service Fungsional ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Mengimplementasikan fungsi murni `removeOvertime` yang memvalidasi path parameter melalui `overtimeIdParamSchema`, melakukan soft delete atomik (`deleted_at = now`, `updated_at = now` dengan filter `isNull(overtimes.deleted_at)`), dan melempar `NotFoundError("Overtime not found")` (`404`) bila record tidak ditemukan atau sudah dihapus.
3. **Controller ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menambahkan route `DELETE /api/overtimes/:id` di bawah [`activeAdminMiddleware`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/admin.ts), lengkap dengan skema response (`200`, `400`, `401`, `403`, `404`, `500`) serta dokumentasi OpenAPI.
4. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan 4 skenario uji baru untuk `DELETE /api/overtimes/:id` (soft delete sukses beserta verifikasi `deleted_at`, `404` pada `GET`/`PUT` setelah dihapus & slot waktu dapat dibuat ulang, `404` record hilang/sudah dihapus, validasi `id` invalid `400`, serta otorisasi admin aktif & token JWT).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **26 pass, 0 fail** (242 assertions).
- `bun test`: **180 pass, 0 fail** (871 assertions) di seluruh 6 file pengujian.
