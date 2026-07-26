import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

export interface HlsVideoProps {
  /** HLS (.m3u8) or direct video URL. */
  readonly src: string;
  readonly className?: string;
  readonly poster?: string;
  /** Render as a blurred, muted ambient backdrop. */
  readonly ambient?: boolean;
}

/**
 * HlsVideo — adaptive-streaming video surface.
 *
 * Uses hls.js for .m3u8 sources (Safari plays them natively). Falls back to a
 * plain <video> for MP4/WebM. When `ambient`, it renders muted, looping, and
 * blurred as a backdrop layer. Failures are swallowed so the ambient aurora
 * behind it remains visible.
 */
export function HlsVideo({ src, className, poster, ambient = false }: HlsVideoProps): ReactNode {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    let hls: Hls | undefined;

    const tryPlay = () => el.play().catch(() => undefined);

    if (src.endsWith('.m3u8') && !el.canPlayType('application/vnd.apple.mpegurl')) {
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
        hls.on(Hls.Events.ERROR, () => setFailed(true));
      } else {
        setFailed(true);
      }
    } else {
      el.src = src;
      tryPlay();
    }

    return () => {
      hls?.destroy();
    };
  }, [src]);

  if (failed) {
    return <div className={cn('bg-aurora absolute inset-0', className)} aria-hidden />;
  }

  return (
    <video
      ref={ref}
      className={cn(
        'h-full w-full',
        ambient ? 'absolute inset-0 object-cover opacity-40 blur-sm' : 'object-contain',
        className,
      )}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setFailed(true)}
      aria-hidden={ambient}
    />
  );
}
