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
    "errors": "Invalid credentials"
  }
  ```

- **Error Response `403 Forbidden`:**
  ```json
  {
    "status": "error",
    "errors": "Account is not active"
  }
  ```
- **Error Response `500 Internal Server Error`:**
  ```json
  {
    "status": "error",
    "errors": "Internal server error"
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
- **Error Response `400 Bad Request`:**
  ```json
  {
    "status": "error",
    "errors": Zod error message
  }
  ```
- **Error Response `401 Unauthorized`:**
  ```json
  {
    "status": "error",
    "errors": "Unauthorized"
  }
  ```
- **Error Response `403 Forbidden`:**
  ```json
  {
    "status": "error",
    "errors": "Account is not active"
  }
  ```
- **Error Response `404 Not Found`:**
  ```json
  {
    "status": "error",
    "errors": "User not found"
  }
  ```
- **Error Response `500 Internal Server Error`:**
  ```json
  {
    "status": "error",
    "errors": "Internal server error"
  }
  ```
