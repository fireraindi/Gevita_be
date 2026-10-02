# API Spesifikasi: Leaves Module (Revisi)

> **Perubahan dari versi sebelumnya:** Tambah endpoint `GET /api/leaves/{id}` untuk detail satu pengajuan cuti.

Semua endpoint membutuhkan header: `Authorization: Bearer <token>`

---

## 1. Mengajukan Cuti

Melakukan pengajuan cuti baru.

- **URL:** `POST /api/leaves`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `start_date` *(string, wajib)*: Tanggal mulai (format: `YYYY-MM-DD`)
  - `end_date` *(string, wajib)*: Tanggal selesai (format: `YYYY-MM-DD`)
  - `reason` *(string, wajib)*: Alasan cuti
  - `image` *(file image, opsional)*: Dokumen pendukung (misal: surat sakit)
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

## 2. Riwayat Cuti

Mendapatkan daftar semua pengajuan cuti milik karyawan yang login.

- **URL:** `GET /api/leaves`
- **Headers:** `Authorization: Bearer <token>`
- **Query Params:**
  - `status` *(string, opsional)*: Filter berdasarkan status (`Pending`, `Approved`, `Rejected`)
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

## 3. Detail Cuti

Mendapatkan detail satu pengajuan cuti berdasarkan ID.

- **URL:** `GET /api/leaves/{id}`
- **Headers:** `Authorization: Bearer <token>`
- **URL Params:**
  - `id` *(integer, wajib)*: ID pengajuan cuti
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
