# MediaFlow

Media server berbasis web: browse dan putar video/audio, upload file, serta live stream video secara loop ke YouTube atau tujuan RTMP lain.

Rencana pengembangan menjadi SaaS: [docs/konsep-saas.md](docs/konsep-saas.md).

## Stack

- Next.js 16 (App Router), React 19, Tailwind CSS 4
- SQLite (`better-sqlite3`)
- Autentikasi JWT di cookie (`jsonwebtoken`, `bcryptjs`)
- `ffmpeg-static` untuk thumbnail dan live stream

## Menjalankan

```bash
npm install
cp .env.example .env.local   # lalu isi JWT_SECRET
npm run dev
```

Buka http://localhost:3003 untuk melihat landing page (tombol **Sewa** dan **Login**). Isi `SEWA_URL` di `.env.local` dengan link kontak (mis. WhatsApp) supaya tombol Sewa mengarah ke sana. Saat pertama kali dijalankan, halaman `/setup` meminta pembuatan akun admin.

Semua data runtime ada di folder `data/` dan tidak ikut ke git:

- `data/media/users/<userId>/`: file video/audio milik tiap akun (folder induk bisa diubah lewat `MEDIA_DIR`). Setiap akun hanya bisa melihat, memutar, upload, dan live stream file di foldernya sendiri.
- `data/mediaflow.db`: database SQLite, dibuat otomatis (bisa diubah lewat `DB_PATH`)

## Gaya tampilan

Acuan gaya adalah landing page (`src/app/page.tsx`). Class bersama seperti `card`, `btn-primary`, `input`, `eyebrow`, `page-title`, dan `alert-error` didefinisikan sebagai `@utility` di `src/app/globals.css`. Pakai class ini di halaman baru agar tampilannya konsisten.

## Struktur

```
data/                (runtime, di-ignore) database + file media
docs/                dokumen perencanaan
src/
  app/
    page.tsx         / : landing page promosi (Sewa + Login)
    (auth)/          route group, tidak memengaruhi URL
      login/         /login
      setup/         /setup: pembuatan admin pertama
    (main)/          halaman yang butuh login (layout.tsx: header bersama)
      browse/        /browse: daftar folder dan file media
      player/[fileId]/ /player/:id: pemutar video/audio + subtitle
      stream/        /stream: kontrol live stream per akun
      admin/users/   /admin/users: kelola user
    api/
      auth/          login, register, me, setup-status, change-password
      admin/users/   CRUD user, masa sewa, reset sandi, stop live (khusus admin)
      files/         daftar file, streaming, subtitle, upload chunk
      folders/       daftar folder
      resume/        simpan/ambil posisi terakhir menonton
      stream/        start (sekarang/terjadwal), stop, status, schedule (batalkan jadwal)
      thumbnail/     thumbnail video via ffmpeg
  components/
    ui/              Logo, Icon, PageHeader (dipakai semua halaman)
    layout/          AppHeader (header setelah login), AuthShell (login/setup)
    auth/            LoginForm
    media/           FileBrowser, UploadDialog
    player/          VideoPlayer, SubtitleOverlay
  lib/
    auth.ts          hash password, JWT, cookie
    db.ts            koneksi SQLite + query
    ffmpeg.ts        lokasi binary ffmpeg
    stream.ts        proses ffmpeg live stream + reconnect
    schedule.ts      jadwal live otomatis (mulai/berhenti), dicek server tiap 5 detik
    media/
      files.ts       scan folder media
      subtitle.ts    parser srt/ass/vtt
  types/
  instrumentation.ts menyalakan pengecek jadwal live saat server start
```

## Jadwal live otomatis

Di halaman Live Stream, bagian **Jadwal otomatis** (klik panah untuk membuka) berisi jam mulai dan jam berhenti. Keduanya opsional:

- Mulai kosong: live dimulai saat tombol diklik. Berhenti kosong: live nonstop.
- Jadwal disimpan di tabel `stream_schedules` dan dijalankan oleh server, jadi tetap berjalan walaupun browser ditutup. Stream key ikut disimpan karena server membutuhkannya saat jadwal tiba.
- Jika server mati saat jam mulai, live tetap dimulai ketika server hidup lagi selama jam berhenti belum lewat. Jika sudah lewat, jadwal ditandai terlewat.
