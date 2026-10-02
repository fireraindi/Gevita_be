# Skema Database: Sistem Manajemen Absensi (Revisi)

> **Perubahan dari versi sebelumnya:** Konsistensi tipe data PK/FK, penambahan soft delete (`deleted_at`), dan penggunaan ENUM untuk kolom status.

---

## 1. Tabel `users`

Menyimpan data identitas karyawan dan informasi login.

| Nama Kolom   | Tipe Data                 | Keterangan                                              |
| ------------ | ------------------------- | ------------------------------------------------------- |
| `id`         | Varchar(255)              | Primary Key, Auto Increment                             |
| `name`       | VARCHAR(100)              | Nama lengkap karyawan                                   |
| `email`      | VARCHAR(100)              | Email untuk login, Unique                               |
| `phone`      | VARCHAR(20)               | Nomor telepon untuk login, Unique                       |
| `password`   | VARCHAR(255)              | Hashed password (bcrypt)                                |
| `position`   | VARCHAR(100)              | Posisi atau jabatan karyawan                            |
| `photo`      | VARCHAR(255)              | URL/Path foto profil, Nullable, default: `profile.webp` |
| `role`       | ENUM('admin', 'employee') | Role pengguna                                           |
| `is_active`  | BOOLEAN                   | Status aktif karyawan, default: `true`                  |
| `created_at` | TIMESTAMP                 | Waktu data dibuat                                       |
| `updated_at` | TIMESTAMP                 | Waktu data diupdate terakhir                            |
| `is_active`  | Boolean                   | Waktu data default true                                 |

---

## 2. Tabel `attendances`

Menyimpan data riwayat absensi masuk dan keluar.

| Nama Kolom       | Tipe Data                                            | Keterangan                                 |
| ---------------- | ---------------------------------------------------- | ------------------------------------------ |
| `id`             | BIGINT UNSIGNED                                      | Primary Key, Auto Increment                |
| `user_id`        | varchar(255)                                         | Foreign Key ke `users.id`                  |
| `check_in_time`  | TIMESTAMP                                            | Waktu absensi masuk                        |
| `check_out_time` | TIMESTAMP                                            | Waktu absensi keluar, Nullable             |
| `check_in_photo` | VARCHAR(255)                                         | URL/Path foto absensi masuk                |
| `status`         | ENUM('Hadir', 'Terlambat', 'Tidak Hadir,sakit,cuti') | Status kehadiran                           |
| `created_at`     | TIMESTAMP                                            | Waktu data dibuat                          |
| `updated_at`     | TIMESTAMP                                            | Waktu data diupdate terakhir               |
| `deleted_at`     | TIMESTAMP                                            | Waktu data dihapus (Soft Delete), Nullable |

---

## 3. Tabel `leaves`

Menyimpan data pengajuan cuti karyawan.

| Nama Kolom   | Tipe Data                               | Keterangan                                         |
| ------------ | --------------------------------------- | -------------------------------------------------- |
| `id`         | BIGINT UNSIGNED                         | Primary Key, Auto Increment                        |
| `user_id`    | varchar(255)                            | Foreign Key ke `users.id`                          |
| `start_date` | DATE                                    | Tanggal mulai cuti                                 |
| `end_date`   | DATE                                    | Tanggal selesai cuti                               |
| `reason`     | TEXT                                    | Alasan pengajuan cuti                              |
| `status`     | ENUM('Pending', 'Approved', 'Rejected') | Status persetujuan                                 |
| `image`      | VARCHAR(255)                            | Foto bukti pendukung (misal surat sakit), Nullable |
| `created_at` | TIMESTAMP                               | Waktu data dibuat                                  |
| `updated_at` | TIMESTAMP                               | Waktu data diupdate terakhir                       |
| `deleted_at` | TIMESTAMP                               | Waktu data dihapus (Soft Delete), Nullable         |

---

## Relasi (ERD)

- `users` memiliki banyak `attendances` (1:N)
- `users` memiliki banyak `leaves` (1:N)
