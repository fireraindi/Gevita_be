# Progress 004: Pembuatan Issue Standarisasi `requireActiveAdmin` untuk Seluruh API Admin

- **Tanggal:** 2026-11-24
- **Status:** Selesai
- **Target Dokumen:** [`issues/require_active_admin_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/require_active_admin_issue.md)

## Ringkasan Pekerjaan
1. Melakukan audit menyeluruh terhadap seluruh pemanggilan `assertAdmin`, `assertRole`, `requireActiveAdmin`, dan pengecekan manual `role !== "admin"` di seluruh folder `src/`.
2. Mengidentifikasi 11 endpoint admin-only di 4 modul (`user`, `jobs`, `overtimes`, dan `leaves`) yang belum memverifikasi status aktif (`is_active`) dan role terkini admin di database.
3. Menyusun task list implementasi lengkap beserta catatan penyesuaian response schema `403` (`t.String()`) dan skenario pengujian pada [`issues/require_active_admin_issue.md`](file:///home/fire/Documents/dev/gevita/backend/issues/require_active_admin_issue.md).
