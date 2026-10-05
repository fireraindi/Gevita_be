# API Spesifikasi: User Module (Revisi)

> **Perubahan dari versi sebelumnya:** Tambah endpoint Update Profile untuk mengubah nama, posisi, dan foto profil.

Semua endpoint membutuhkan header: `Authorization: Bearer <token>`

---

---

## 2. Update Profile

Memperbarui data profil pengguna (nama, posisi, dan/atau foto).

- **URL:** `PUT /api/user/profile`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `multipart/form-data`
- **Request Body:**
  - `name` _(string, opsional)_: Nama baru
  - `position` _(string, opsional)_: Posisi/jabatan baru
  - `photo` _(file image, opsional)_: Foto profil baru
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

## 3. Change Password

Mengubah password pengguna yang sedang login.

- **URL:** `PUT /api/auth/change-password`
- **Headers:** `Authorization: Bearer <token>`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "old_password": "password123",
    "new_password": "newpassword456"
  }
  ```
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Update password successful"
  }
  ```
- **Success Response `400 Bad Request`:**
  ```json
  {
    "status": "success",
    "message": zod error message
  }
  ```
- **Success Response `401 Unauthorized`:**
  ```json
  {
    "status": "success",
    "message": "Unauthorized"
  }
  ```
- **Error Response `422 Unprocessable Entity`:**
  ```json
  {
    "status": "error",
    "message": "Password does not match"
  }
  ```
- **Error Response `500 Internal Server Error`:**
  ```json
  {
    "status": "error",
    "errors": "Internal server error"
  }
  ```
