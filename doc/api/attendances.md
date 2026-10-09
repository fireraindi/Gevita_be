# API Spesifikasi: Attendances Module (Revisi)

> **Perubahan dari versi sebelumnya:** Response check-in dan history menyertakan `check_in_photo`. Tambah endpoint `GET today` untuk cek status absensi hari ini.

Semua endpoint membutuhkan header: `Authorization: Bearer <token>`

---

## 1. Check In

Melakukan absensi masuk. Membutuhkan foto sebagai bukti.

- **URL:** `POST /api/attendances/check-in`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `photo` _(file image, wajib)_: Foto selfie check-in
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Check-in berhasil",
    "data": {
      "id": 1,
      "date": "2023-10-25",
      "check_in_time": "2023-10-25T08:00:00Z",
      "check_in_photo": "https://example.com/attendances/checkin-budi.jpg",
      "status": "Hadir"
    }
  }
  ```
- **Error Response `409 Conflict`:**
  ```json
  {
    "status": "error",
    "message": "Anda sudah melakukan check-in hari ini"
  }
  ```

---

## 2. Check Out

Melakukan absensi keluar. Tidak memerlukan foto.

- **URL:** `POST /api/attendances/check-out`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** (Kosong)
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Check-out berhasil",
    "data": {
      "id": 1,
      "check_in_time": "2023-10-25T08:00:00Z",
      "check_out_time": "2023-10-25T17:00:00Z",
      "status": "Hadir"
    }
  }
  ```
- **Error Response `400 Bad Request`:**
  ```json
  {
    "status": "error",
    "message": "Anda belum melakukan check-in hari ini"
  }
  ```

---

## 3. Status Absensi Hari Ini

Mengecek status absensi karyawan pada hari ini (berguna untuk kondisional tampil tombol check-in/check-out di UI).

- **URL:** `GET /api/attendances/today`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response `200 OK` (sudah check-in):**
  ```json
  {
    "status": "success",
    "statusCode": 200,
    "data": {
      "id": 1,
      "check_in_time": "2023-10-25T08:00:00Z",
      "check_in_photo": "http://localhost:3000/uploads/checkin/1760000000000.jpg",
      "check_out_time": null,
      "status": "Hadir"
    }
  }
  ```
- **Success Response `200 OK` (belum check-in):**
  ```json
  {
    "status": "success",
    "statusCode": 200,
    "data": null
  }
  ```
- **Error Response `401 Unauthorized`:**
  ```json
  {
    "status": "error",
    "statusCode": 401,
    "errors": "Unauthorized"
  }
  ```

---

## 4. History Absensi

Mendapatkan riwayat absensi karyawan.

- **URL:** `GET /api/attendances/history`
- **Headers:** `Authorization: Bearer <token>`
- **Query Params:**
  - `month` _(integer, opsional)_: Filter bulan (1-12)
  - `year` _(integer, opsional)_: Filter tahun (contoh: 2023)
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": 1,
        "date": "2023-10-25",
        "check_in_time": "08:00:00",
        "check_out_time": "17:00:00",
        "check_in_photo": "https://example.com/attendances/checkin-budi.jpg",
        "status": "Hadir"
      }
    ]
  }
  ```
