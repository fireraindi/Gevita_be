# Progress 011: Implementasi API List Overtimes (`GET /api/overtimes`)

- **Tanggal:** 2026-11-27
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/37 ([`issues/list_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/list_overtime_issue.md))

## Ringkasan Implementasi
1. **Model Data DTO (`src/features/overtimes/model/`):**
   - Menambahkan `ListOvertimesQueryInput` pada [`request.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/request.ts) (`name`, `start_date`, `end_date`, `limit`, `page`).
   - Menambahkan `OvertimePagination` dan `ListOvertimesSuccessResponse` pada [`response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts) tanpa penggunaan `any` maupun `unknown`.
2. **Validasi Query Zod ([`src/features/overtimes/validation.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/validation.ts)):**
   - Menambahkan `listOvertimesQuerySchema` dengan `paginationNumber` (`limit` default `20`, min `1`, max `100`; `page` default `1`, min `1`), `optionalDateQuery` (`isValidCalendarDate` pada `start_date` & `end_date`), dan pengecekan `end_date >= start_date`.
3. **Service Fungsional ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Mengimplementasikan fungsi murni `getOvertimes` dengan filter soft delete (`deleted_at IS NULL`), `innerJoin(users, ...)` untuk pencarian `users.name` (menggunakan `escapeIlikePattern`), rentang tanggal inklusif (`gte`/`lte`), sorting `date DESC, id DESC`, query `count()`, pagination `.limit().offset()`, serta helper `toOvertimeDetailData` untuk normalisasi waktu `HH:MM`.
4. **Controller ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menambahkan route `GET /api/overtimes` di bawah [`activeAdminMiddleware`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/admin.ts), lengkap dengan skema response `200`, `400`, `401`, `403`, `500` dan dokumentasi OpenAPI query parameters.
5. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Menambahkan 7 skenario uji baru untuk `GET /api/overtimes` (list default pagination & eksklusi soft-delete, filter `name` case-insensitive & aman wildcard, rentang tanggal inklusif `start_date` & `end_date`, custom pagination & sorting terbaru, empty result, validasi query invalid `400`, serta otorisasi admin aktif & JWT).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **33 pass, 0 fail** (315 assertions).
- `bun test`: **187 pass, 0 fail** (944 assertions) di seluruh 6 file pengujian.
