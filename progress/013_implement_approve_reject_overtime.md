# Progress 013: Implementasi API Approve & Reject Overtime (`PATCH /api/overtimes/:id/approve` & `/reject`)

- **Tanggal:** 2026-11-27
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/39 ([`issues/update_status_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/update_status_overtime_issue.md))

## Ringkasan Implementasi
1. **Model Response DTO ([`src/features/overtimes/model/response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts)):**
   - Menambahkan `ApproveOvertimeSuccessResponse` (`"Data lembur berhasil disetujui"`) dan `RejectOvertimeSuccessResponse` (`"Data lembur berhasil ditolak"`) tanpa penggunaan `any` maupun `unknown`.
2. **Service Fungsional ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Menambahkan helper internal `updateOvertimeStatus(rawId, status)` serta pure async function yang diekspor `approveOvertime` (`status: true`) dan `rejectOvertime` (`status: false`) menggunakan `overtimeIdParamSchema`, filter `isNull(overtimes.deleted_at)`, `updated_at = new Date()`, dan `NotFoundError("Overtime not found")` (`404`) jika data tidak ada/sudah dihapus.
3. **Controller ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menambahkan route `PATCH /api/overtimes/:id/approve` dan `PATCH /api/overtimes/:id/reject` di bawah [`activeAdminMiddleware`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/admin.ts), lengkap dengan skema response `200`, `400`, `401`, `403`, `404`, `500`, serta dokumentasi OpenAPI.
4. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan 4 skenario uji baru untuk `/approve` dan `/reject` (ubah status ke `false` lalu `true` beserta verifikasi DB, validasi `id` invalid `400`, `404` missing/soft-deleted, serta otorisasi admin aktif & token JWT).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **33 pass, 0 fail** (361 assertions).
- `bun test`: **187 pass, 0 fail** (990 assertions) di seluruh 6 file pengujian.
