# Progress 005: Standarisasi `requireActiveAdmin` di Seluruh Endpoint Admin-Only

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Issue Terkait:** https://github.com/fireraindi/Gevita_be/issues/33 ([`issues/require_active_admin_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/require_active_admin_issue.md))

## Ringkasan Implementasi
1. **Modul Users ([`src/features/user/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/user/controller.ts)):**
   - Mengganti `assertAdmin(authUser)` menjadi `await requireActiveAdmin(authUser)` pada `POST /api/users`, `GET /api/users`, `GET /api/users/:id`, dan `PATCH /api/users/:id`.
   - Mengubah skema response `403` menjadi `errors: t.String()`.
2. **Modul Jobs ([`src/features/jobs/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/jobs/controller.ts)):**
   - Mengganti `assertAdmin(authUser)` menjadi `await requireActiveAdmin(authUser)` pada `GET /api/jobs`, `POST /api/jobs`, `PUT /api/jobs/:id`, dan `DELETE /api/jobs/:id`.
   - Mengubah skema response `403` menjadi `errors: t.String()`.
3. **Modul Overtimes ([`src/features/overtimes/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/overtimes/controller.ts)):**
   - Mengganti `assertAdmin(authUser)` menjadi `await requireActiveAdmin(authUser)` pada `POST /api/overtimes`.
   - Mengubah skema response `403` menjadi `errors: t.String()`.
4. **Modul Leaves ([`src/features/leaves/service.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/leaves/service.ts) & [`src/features/leaves/controller.ts`](file:///home/fire/Documents/dev/gevita/backend/src/features/leaves/controller.ts)):**
   - Menggunakan `await requireActiveAdmin(currentUser)` pada `approveLeave`, `rejectLeave`, serta pada `getLeaveDetail` ketika pemohon bukan pemilik data cuti tersebut.
   - Mengubah skema response `403` pada detail, approve, dan reject menjadi `errors: t.String()`.
5. **Pengujian:**
   - Menambahkan test case untuk admin non-aktif (`"User account is inactive"`) dan admin yang rolenya telah diturunkan ke `employee` (`"Forbidden"`) pada [`tests/user.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/user.test.ts), [`tests/job.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/job.test.ts), [`tests/overtime.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/overtime.test.ts), dan [`tests/leave.test.ts`](file:///home/fire/Documents/dev/gevita/backend/tests/leave.test.ts).

## Hasil Verifikasi
- `bun run typecheck`: Lulus tanpa error (`exit code 0`).
- `bun test`: **166 pass, 0 fail** (700 assertions) di seluruh 6 file pengujian.
