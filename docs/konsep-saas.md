# Konsep MediaFlow SaaS

Dokumen lengkap (arsitektur, temuan scan, roadmap): https://claude.ai/artifact/KNdvFTBT7DsSnBAedr7RLx

## Ringkasan roadmap

1. **Fondasi dan keamanan** — tutup temuan scan, PostgreSQL, data per user, kolom role.
2. **Storage dan media** — R2/S3, upload langsung dari browser, transcode sekali saat upload.
3. **Worker stream** — antrian BullMQ, worker ffmpeg terpisah, status + heartbeat di DB.
4. **Monetisasi** — paket, kuota storage dan stream, payment gateway.
5. **Fitur produk** — multi-tujuan, jadwal, playlist, dashboard pemakaian.

## Keputusan yang belum diambil

- [ ] Fokus produk: live stream loop 24/7 atau media library di cloud
- [ ] Target pasar: Indonesia (Midtrans/Xendit) atau global (Stripe)
- [ ] Infrastruktur: VPS sendiri atau managed + worker di VPS
