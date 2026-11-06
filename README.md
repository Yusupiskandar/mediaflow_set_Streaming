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

Buka http://localhost:3003. Saat pertama kali dijalankan, halaman `/setup` meminta pembuatan akun admin.

Semua data runtime ada di folder `data/` dan tidak ikut ke git:

- `data/media/users/<userId>/`: file video/audio milik tiap akun (folder induk bisa diubah lewat `MEDIA_DIR`). Setiap akun hanya bisa melihat, memutar, upload, dan live stream file di foldernya sendiri.
- `data/mediaflow.db`: database SQLite, dibuat otomatis (bisa diubah lewat `DB_PATH`)

## Struktur

```
data/                (runtime, di-ignore) database + file media
docs/                dokumen perencanaan
src/
  app/
    (auth)/          route group, tidak memengaruhi URL
      login/         /login
      setup/         /setup: pembuatan admin pertama
    (main)/          halaman yang butuh login
      browse/        /browse: daftar folder dan file media
      player/[fileId]/ /player/:id: pemutar video/audio + subtitle
      stream/        /stream: kontrol live stream per akun
      admin/users/   /admin/users: kelola user
    api/
      auth/          login, register, me, setup-status
      admin/users/   CRUD user (khusus admin)
      files/         daftar file, streaming, subtitle, upload chunk
      folders/       daftar folder
      resume/        simpan/ambil posisi terakhir menonton
      stream/        start, stop, status live stream
      thumbnail/     thumbnail video via ffmpeg
  components/
    auth/            LoginForm
    media/           FileBrowser, UploadDialog
    player/          VideoPlayer, SubtitleOverlay
  lib/
    auth.ts          hash password, JWT, cookie
    db.ts            koneksi SQLite + query
    ffmpeg.ts        lokasi binary ffmpeg
    stream.ts        proses ffmpeg live stream + reconnect
    media/
      files.ts       scan folder media
      subtitle.ts    parser srt/ass/vtt
  types/
```
