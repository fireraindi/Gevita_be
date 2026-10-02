# Backend Setup

Proyek backend ini menggunakan **Bun**, **Elysia**, **Drizzle ORM**, **Zod**, dan **PostgreSQL**.

Struktur direktori menggunakan **Feature-Based** (Modul) di mana setiap fitur memiliki foldernya masing-masing (contoh: `src/features/user/`).

## Cara Menjalankan

### 1. Prasyarat
- Pastikan [Bun](https://bun.sh) terpasang di sistem.
- Pastikan database PostgreSQL berjalan (buat database dan atur URL-nya).

### 2. Instalasi
Install semua dependensi dengan perintah:
```bash
bun install
```

### 3. Konfigurasi Environment
Buat file `.env` dan masukkan `DATABASE_URL` (contoh disediakan jika ada, jika tidak, gunakan ini):
```env
DATABASE_URL="postgres://user:password@localhost:5432/db"
```

### 4. Database Migrasi (Drizzle)
Konfigurasi database berada di `drizzle.config.ts`.
Untuk meng-generate migrasi dari schema yang dibuat di fitur-fitur, jalankan:
```bash
bunx drizzle-kit generate
```
Lalu terapkan migrasi ke database:
```bash
bunx drizzle-kit push
```

### 5. Start Server
Untuk menjalankan mode *development*:
```bash
bun run dev
```
*(Catatan: Anda mungkin perlu menambahkan script `dev` di `package.json` yang mengarah ke `bun --watch src/index.ts` jika belum ada).*