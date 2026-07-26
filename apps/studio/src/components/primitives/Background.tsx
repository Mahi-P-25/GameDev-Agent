import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../design/cn';

/**
 * Nova Background System — optional, composable ambient layers.
 *
 * Infrastructure for cinematic backdrops. Every layer is independently
 * toggleable and degrades gracefully (e.g. video falls back to aurora, shader
 * slot is reserved for future WebGL work). Prefers-reduced-motion is honored by
 * the underlying CSS animations.
 */

export interface BackgroundProps {
  readonly children?: ReactNode;
  readonly className?: string;
  /** Slow drifting aurora gradient behind content. */
  readonly aurora?: boolean;
  /** Film-grain noise overlay. */
  readonly noise?: boolean;
  /** Darkened edges (vignette). */
  readonly vignette?: 'none' | 'soft' | 'strong';
  /** Radial gradient spotlight from top. */
  readonly gradient?: boolean;
  /** Loop a muted, blurred video (HLS or MP4). */
  readonly videoSrc?: string;
  /** Reserve a WebGL/canvas slot for future shader backgrounds. */
  readonly shader?: boolean;
}

/**
 * Background — a single positioned layer stack. Place as the first child of a
 * `relative` container; it fills `absolute inset-0` and ignores pointer events.
 */
export function Background({
  children,
  className,
  aurora = false,
  noise = false,
  vignette = 'none',
  gradient = false,
  videoSrc,
  shader = false,
}: BackgroundProps): ReactNode {
  const vignetteClass =
    vignette === 'soft' ? 'vignette-soft' : vignette === 'strong' ? 'vignette' : '';
  return (
    <div className={cn('relative', className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {aurora && <div className="bg-aurora absolute inset-0" aria-hidden />}
        {gradient && <div className="gradient-overlay absolute inset-0" aria-hidden />}
        {videoSrc && <VideoLayer src={videoSrc} />}
        {shader && <ShaderSlot />}
        {vignetteClass && <div className={cn('absolute inset-0', vignetteClass)} aria-hidden />}
        {noise && <div className="noise absolute inset-0" aria-hidden />}
      </div>
      {children}
    </div>
  );
}

/** Muted, blurred, autoplaying video backdrop with graceful fallback. */
function VideoLayer({ src }: { src: string }): ReactNode {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) return;
    el.play().catch(() => {
      /* autoplay may be blocked; fallback aurora shows through */
    });
  }, []);

  if (failed) {
    return <div className="bg-aurora absolute inset-0" aria-hidden />;
  }
  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover opacity-40 blur-sm"
      src={src}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setFailed(true)}
      aria-hidden
    />
  );
}

/**
 * ShaderSlot — reserved canvas for future GLSL ambient backgrounds.
 * Currently a no-op placeholder so the layout contract is stable.
 */
function ShaderSlot(): ReactNode {
  return (
    <canvas className="absolute inset-0 h-full w-full opacity-0" aria-hidden data-nova-shader="" />
  );
}
