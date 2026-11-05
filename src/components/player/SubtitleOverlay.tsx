'use client';

interface SubtitleOverlayProps {
  text: string;
}

export default function SubtitleOverlay({ text }: SubtitleOverlayProps) {
  if (!text) return null;

  return (
    <div className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none">
      <div className="bg-black/75 px-4 py-2 rounded max-w-3xl">
        <p className="text-white text-lg text-center whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </div>
  );
}
