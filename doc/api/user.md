# API Spesifikasi: User Module (Revisi)

> **Perubahan dari versi sebelumnya:** Tambah endpoint Update Profile untuk mengubah nama, posisi, dan foto profil.

Semua endpoint membutuhkan header: `Authorization: Bearer <token>`

---

## 1. Get Profile

Mendapatkan informasi profil pengguna yang sedang login.

- **URL:** `GET /api/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "data": {
      "id": 1,
      "name": "Budi Santoso",
      "email": "budi@example.com",
      "position": "Software Engineer",
      "photo": "https://example.com/photos/budi.jpg",
      "role": "employee",
      "is_active": true
    }
  }
  ```
- **Error Response `401 Unauthorized`:**
  ```json
  {
    "status": "error",
    "message": "Token tidak valid atau sudah kadaluarsa"
  }
  ```

---

## 2. Update Profile

Memperbarui data profil pengguna (nama, posisi, dan/atau foto).

- **URL:** `PUT /api/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `name` *(string, opsional)*: Nama baru
  - `position` *(string, opsional)*: Posisi/jabatan baru
  - `photo` *(file image, opsional)*: Foto profil baru
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Profil berhasil diperbarui",
    "data": {
      "id": 1,
      "name": "Budi Santoso",
      "email": "budi@example.com",
      "position": "Senior Engineer",
      "photo": "https://example.com/photos/budi-new.jpg",
      "role": "employee"
    }
  }
  ```
- **Error Response `422 Unprocessable Entity`:**
  ```json
  {
    "status": "error",
    "message": "Format file foto tidak valid"
  }
  ```
