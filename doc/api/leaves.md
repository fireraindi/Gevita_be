# API Spesifikasi: Leaves Module (Revisi)

> **Perubahan dari versi sebelumnya:** Tambah endpoint `GET /api/leaves/{id}` untuk detail satu pengajuan cuti.

Semua endpoint membutuhkan header: `Authorization: Bearer <token>`

---

## 1. Daftar Pengajuan Cuti (Admin)

Mengambil daftar pengajuan cuti semua karyawan. Hanya admin aktif yang dapat mengakses endpoint ini. Riwayat milik karyawan yang sedang login tetap tersedia melalui `GET /api/leaves/history`.

- **URL:** `GET /api/leaves`
- **Query params:**
  - `search` (opsional): pencarian sebagian nama karyawan, tanpa membedakan kapital.
  - `category` (opsional): `Sakit` atau `Izin`.
  - `start_date` dan `end_date` (opsional): tanggal `YYYY-MM-DD`, inklusif dan wajib dikirim bersama. Jika keduanya tidak dikirim, gunakan bulan berjalan zona waktu `Asia/Jakarta`.
  - Rentang tanggal maksimal 60 hari kalender termasuk tanggal awal dan akhir; `end_date` boleh sama dengan `start_date`.
  - `limit` (opsional): integer 1–100, default 20.
  - `page` (opsional): integer positif, default 1.
- Cuti yang rentang tanggalnya beririsan dengan filter akan ditampilkan, termasuk cuti yang dimulai sebelum `start_date` atau berakhir setelah `end_date`.
- Hasil diurutkan dari pengajuan terbaru (`created_at` menurun; ID menurun untuk urutan yang stabil). Data yang dihapus lunak tidak disertakan.
- **Success `200 OK`:**

  ```json
  {
    "status": "success",
    "message": "Success get leaves",
    "data": [
      {
        "id": 1,
        "userId": "user-id",
        "name": "Water Erifsen",
        "startDate": "2026-10-01",
        "endDate": "2026-10-03",
        "category": "Sakit",
        "status": "Pending"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
  }
  ```

- **Errors:** `400 Bad Request` untuk query tidak valid; `401 Unauthorized` untuk token tidak valid/tidak ada; `403 Forbidden` untuk non-admin aktif (akun nonaktif mengembalikan `User account is inactive`); `500 Internal Server Error` untuk kegagalan server.

## 2. Mengajukan Cuti

Melakukan pengajuan cuti baru.

- **URL:** `POST /api/leaves`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `start_date` _(string, wajib)_: Tanggal mulai (format: `YYYY-MM-DD`)
  - `end_date` _(string, wajib)_: Tanggal selesai (format: `YYYY-MM-DD`)
  - `reason` _(string, wajib)_: Alasan cuti
  - `image` _(file image, opsional)_: Dokumen pendukung (misal: surat sakit)
- **Success Response `201 Created`:**
  ```json
  {
    "status": "success",
    "message": "Pengajuan cuti berhasil dikirim",
    "data": {
      "id": 1,
      "start_date": "2023-11-01",
      "end_date": "2023-11-03",
      "reason": "Acara keluarga",
      "status": "Pending",
      "image": null,
      "created_at": "2023-10-25T10:00:00Z"
    }
  }
  ```
- **Error Response `422 Unprocessable Entity`:**
  ```json
  {
    "status": "error",
    "message": "Tanggal mulai tidak boleh lebih besar dari tanggal selesai"
  }
  ```

---

## 3. Riwayat Cuti

Mendapatkan daftar semua pengajuan cuti milik karyawan yang login.

- **URL:** `GET /api/leaves`
- **Headers:** `Authorization: Bearer <token>`
- **Query Params:**
  - `status` _(string, opsional)_: Filter berdasarkan status (`Pending`, `Approved`, `Rejected`)
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": 1,
        "start_date": "2023-11-01",
        "end_date": "2023-11-03",
        "reason": "Acara keluarga",
        "status": "Pending",
        "image": null,
        "created_at": "2023-10-25T10:00:00Z"
      }
    ]
  }
  ```

---

## 4. Detail Cuti

Mendapatkan detail satu pengajuan cuti berdasarkan ID.

- **URL:** `GET /api/leaves/{id}`
- **Headers:** `Authorization: Bearer <token>`
- **URL Params:**
  - `id` _(integer, wajib)_: ID pengajuan cuti
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "start_date": "2023-11-01",
      "end_date": "2023-11-03",
      "reason": "Acara keluarga",
      "status": "Approved",
      "image": "https://example.com/leaves/surat-sakit.jpg",
      "created_at": "2023-10-25T10:00:00Z",
      "updated_at": "2023-10-26T09:00:00Z"
    }
  }
  ```
- **Error Response `404 Not Found`:**
  ```json
  {
    "status": "error",
    "message": "Data cuti tidak ditemukan"
  }
  ```
