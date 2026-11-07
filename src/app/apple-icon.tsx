import { ImageResponse } from 'next/og';

// Ikon saat situs disimpan ke layar utama iPhone/iPad (butuh PNG, jadi dibuat dari kode).
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#155dfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24">
          <path d="M7 4l13 8-13 8V4z" fill="#ffffff" />
        </svg>
      </div>
    ),
    size
  );
}
