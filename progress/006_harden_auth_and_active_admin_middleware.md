# Progress 006: Perbaikan Menyeluruh Keamanan Auth, `activeAdminMiddleware`, dan Penghapusan Dead Code

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/33

## Perubahan yang Diterapkan
1. **Poin 1 — Menutup Celah *Fail-Open* di [`src/helpers/role.ts`](file:///home/fire/Documents/dev/gevita/backend/src/helpers/role.ts):**
   - `requireActiveAdmin` kini melempar `UnauthorizedError("Unauthorized")` apabila akun admin tidak lagi ditemukan di database (`!account`), menutup celah *fail-open* saat akun admin dihapus.
   - Menambahkan seeding user `test-admin` di [`tests/helpers/apiTestHelpers.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/helpers/apiTestHelpers.ts) agar seluruh pengujian menggunakan akun admin nyata di database test.
2. **Poin 2 — Standarisasi Layer dengan [`src/middleware/admin.ts`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/admin.ts):**
   - Membuat `activeAdminMiddleware` dan menerapkannya secara seragam di seluruh controller endpoint admin-only pada [`user/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/user/controller.ts), [`jobs/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/jobs/controller.ts), [`overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts), [`attendances/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/attendances/controller.ts), dan [`leaves/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/leaves/controller.ts).
3. **Poin 3 — Pembersihan Dead Code ([`src/helpers/role.ts`](file:///home/fire/Documents/dev/gevita/backend/src/helpers/role.ts)):**
   - Menghapus `assertAdmin` dan `assertRole` yang sudah tidak digunakan agar seluruh endpoint baru tidak lagi memakai validasi JWT-only.
4. **Poin 4 — Pengecekan Status Aktif Terpusat di [`src/middleware/auth.ts`](file:///home/fire/Documents/dev/gevita/backend/src/middleware/auth.ts):**
   - Mengekstrak helper `authenticateRequest` yang memverifikasi `is_active` dan role terbaru di database untuk setiap request terautentikasi (baik `admin` maupun `employee`), sehingga karyawan non-aktif langsung ditolak dengan `403 Forbidden` (`"User account is inactive"`).
5. **Pengujian Regresi:**
   - Menambahkan verifikasi token admin terhapus (`401 Unauthorized`) di [`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts) dan karyawan non-aktif pada endpoint employee (`403 Forbidden`) di [`tests/leave.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/leave.test.ts).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test`: **166 pass, 0 fail** (713 assertions) di seluruh 6 file pengujian.
