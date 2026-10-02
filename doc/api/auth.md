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
    "identifier": "budi@example.com",
    "password": "password123"
  }
  ```
- **Success Response `200 OK`:**
  ```json
  {
    "status": "success",
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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

## 2. Get Profile

Mendapatkan informasi profil pengguna yang sedang login.

- **URL:** `GET /api/auth/me`
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
