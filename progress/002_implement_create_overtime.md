# Progress 002: Implementasi Tabel `overtimes` & API Create Overtime (`POST /api/overtimes`)

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/32 ([`issues/create_overtime_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/create_overtime_issue.md))

## Ringkasan Implementasi
1. **Skema Database (`overtimes`):**
   - Menambahkan tabel `overtimes` beserta index `overtimes_user_id_idx` dan `overtimes_date_idx` pada [`src/db/schema.ts`](file:///home/fire/Documents/dev/gevita/backend/src/db/schema.ts).
   - Sinkronisasi ke database melalui `bun run db:push` berhasil diterapkan (`[✓] Changes applied`).
2. **DTO & Strict Typing:**
   - Membuat [`src/features/overtimes/model/request.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/request.ts) (`CreateOvertimeRequest`) dan [`src/features/overtimes/model/response.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/model/response.ts) (`OvertimeResponseData`, `CreateOvertimeSuccessResponse`) tanpa menggunakan `any` maupun `unknown`.
3. **Validasi Zod:**
   - Mengimplementasikan [`src/features/overtimes/validation.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/validation.ts) untuk memvalidasi UUID `userId`, bilangan bulat positif `timeFrame > 0`, format waktu `HH:MM` pada `start` & `end`, tanggal kalender valid `YYYY-MM-DD`, serta aturan tambahan: `start` tidak boleh sama dengan `end`, `start` tidak boleh lebih besar dari `end`, dan `end` tidak boleh lebih kecil dari `start`.
4. **Service & Controller (Paradigma Fungsional):**
   - Mengimplementasikan fungsi murni `createOvertime` di [`src/features/overtimes/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/service.ts) dengan normalisasi format `TIME` PostgreSQL (`HH:MM:SS` → `HH:MM`) dan pengecekan user (`404 Not Found`).
   - Membuat [`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts) dengan proteksi `authMiddleware` + `assertAdmin(authUser)` dan mendaftarkannya pada [`src/index.ts`](file:///home/fire/Documents/dev/gevita/backend/src/index.ts).
5. **Pengujian (`tests/overtime.test.ts`):**
   - Menambahkan isolasi cleanup tabel `overtimes` pada [`tests/helpers/apiTestHelpers.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/helpers/apiTestHelpers.ts).
   - Menulis 8 test case di [`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts) mencakup pembuatan lembur sukses, validasi `timeFrame`, format waktu, aturan `start > end` / `end < start`, tanggal invalid, UUID / user tidak ditemukan (404), otorisasi employee (403), dan token invalid/kosong (401).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test tests/overtime.test.ts`: **8 pass, 0 fail** (63 assertions).
- `bun test`: **159 pass, 0 fail** (637 assertions) di 6 file test.
