# API Spesifikasi: Auth Module (Revisi)

> **Perubahan dari versi sebelumnya:** Login response diperkaya dengan data user, tambah endpoint Logout, dan tambah error response standar.

Endpoint **publik** (tidak butuh token): `POST /api/auth/login`
Endpoint **terproteksi** (butuh token): semua endpoint lainnya

---

## 1. Login

Mendapatkan JWT token untuk otentikasi.

- **URL:** `POST /api/auth/login`
- **Content-Type:** `application/json`
- **Request Body:**
  ```json
  {
    "email": "budi@example.com",
    "password": "password123"
  }
  ```
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": 1,
        "name": "Budi Santoso",
        "email": "budi@example.com",
        "position": "Software Engineer",
        "photo": "https://example.com/photos/budi.jpg",
        "role": "employee"
      }
    }
  }
  ```
- **Error Response `401 Unauthorized`:**
  ```json
  {
    "status": "error",
    "message": "Email atau password salah"
  }
  ```

---

## 2. Logout

Mencabut (invalidate) JWT token yang aktif.

- **URL:** `POST /api/auth/logout`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:** (Kosong)
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Logout successful"
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

## 3. Change Password

Mengubah password pengguna yang sedang login.

- **URL:** `POST /api/auth/change-password`
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
    "message": "Password berhasil diubah"
  }
  ```
- **Error Response `422 Unprocessable Entity`:**
  ```json
  {
    "status": "error",
    "message": "Password lama tidak sesuai"
  }
  ```
