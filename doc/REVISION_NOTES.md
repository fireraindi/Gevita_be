# Catatan Revisi Dokumentasi

> Dokumen ini merangkum semua temuan masalah pada `docs/` saat ini dan perubahan yang dilakukan di folder `revision/`.

---

## Database (`database/schema.md`)

| # | Masalah | Revisi |
|---|---------|--------|
| 1 | `users.id` bertipe `Varchar(255)` — tidak konsisten untuk PK, harusnya `BIGINT UNSIGNED` | Diubah ke `BIGINT UNSIGNED AUTO_INCREMENT` |
| 2 | `attendances.user_id` bertipe `Varchar(255)` tapi `leaves.user_id` bertipe `BIGINT` — FK tidak cocok dengan PK `users.id` | Diseragamkan ke `BIGINT UNSIGNED` |
| 3 | `attendances.id` bertipe `Int`, `leaves.id` bertipe `BIGINT` — tidak konsisten antar tabel | Diseragamkan ke `BIGINT UNSIGNED AUTO_INCREMENT` |
| 4 | Kolom `deleted_at` (soft delete) tidak ada di semua tabel, padahal disebutkan di issue | Ditambahkan ke semua tabel |
| 5 | `status` di `attendances` dan `leaves` pakai `VARCHAR(50)` padahal nilainya terbatas | Diubah ke `ENUM` dengan nilai-nilai yang terdefinisi |

---

## API

### `api/auth.md`
| # | Masalah | Revisi |
|---|---------|--------|
| 1 | Login response hanya kembalikan `user_id` — frontend perlu data user lengkap | Tambah `user` object di response |
| 2 | Tidak ada endpoint **Logout** | Tambah endpoint `POST /api/auth/logout` |
| 3 | Tidak ada error response standar untuk semua endpoint | Tambah section Error Response |

### `api/user.md`
| # | Masalah | Revisi |
|---|---------|--------|
| 1 | Hanya ada GET Profile, tidak ada **Update Profile** (nama, posisi, foto) | Tambah endpoint `PUT /api/user/profile` |

### `api/attendances.md`
| # | Masalah | Revisi |
|---|---------|--------|
| 1 | Check-in response tidak menyertakan `check_in_photo` URL | Ditambahkan ke response body |
| 2 | History response tidak menyertakan `check_in_photo` URL | Ditambahkan ke response body |
| 3 | Tidak ada endpoint GET today's attendance (untuk cek status check-in hari ini) | Tambah endpoint `GET /api/attendances/today` |

### `api/leaves.md`
| # | Masalah | Revisi |
|---|---------|--------|
| 1 | Tidak ada endpoint GET detail satu pengajuan cuti | Tambah endpoint `GET /api/leaves/{id}` |
