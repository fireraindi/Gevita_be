# Progress 012: Penambahan Kolom `status` Boolean & Penghapusan `GET /api/overtimes/:id`

- **Tanggal:** 2026-11-27
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/38 ([`issues/fix_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/fix_overtime_issue.md))

## Ringkasan Implementasi
1. **Skema Database ([`src/db/schema.ts`](file:///home/fire/Documents/dev/gevita/backend/src/db/schema.ts)):**
   - Menambahkan kolom `status: boolean("status").notNull().default(false)` pada tabel `overtimes`.
   - Menerapkan perubahan skema ke database melalui `bun run db:push` (`[✓] Changes applied`).
2. **Model Response DTO ([`src/features/overtimes/model/response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts)):**
   - Mengganti `OvertimeDetailData` menjadi `OvertimeListItem` dengan properti `status: boolean`, menjadikan `OvertimeResponseData extends OvertimeListItem`, serta menghapus `DetailOvertimeSuccessResponse`.
3. **Service Layer ([`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts)):**
   - Menetapkan `status: true` secara otomatis pada `createOvertime` (karena dibuat langsung oleh admin).
   - Memperbarui `overtimeListColumns`, `overtimeReturningColumns`, `toOvertimeListItem`, dan `toOvertimeResponseData` agar seluruh operasi (`POST`, `PUT`, `GET` list) mengembalikan field `status`.
   - Menghapus fungsi `getOvertimeById`.
4. **Controller ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Menambahkan `status: t.Boolean()` pada `overtimeListItemSchema` dan `overtimeDataSchema`.
   - Menghapus route `.get("/:id", ...)` beserta import `DetailOvertimeSuccessResponse` dan `getOvertimeById`.
5. **Pengujian ([`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts)):**
   - Memverifikasi `status: true` pada response `POST /api/overtimes` (serta kolom `status` di database), `PUT /api/overtimes/:id`, dan `GET /api/overtimes`.
   - Menghapus blok pengujian `GET /api/overtimes/:id` dan memastikan akses ke `GET /api/overtimes/:id` kini mengembalikan `404`.

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **29 pass, 0 fail** (272 assertions).
- `bun test`: **183 pass, 0 fail** (901 assertions) di seluruh 6 file pengujian.
