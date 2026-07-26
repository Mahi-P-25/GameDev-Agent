/**
 * Nova Design System — public surface for the Sprint 11 visual foundation.
 *
 * Import primitives via `@/components/primitives` (Vite alias can be added) or
 * the relative path. Everything here is presentational and token-driven.
 */

export {
  Container,
  Section,
  Stack,
  Grid,
  Surface,
  Dock,
  Shell,
  OpeningStage,
  Hero,
  ContextStrip,
  ContextPanel,
  QuietList,
  NovaMark,
  NovaWordmark,
} from './Layout';
export { CinematicHero } from './Layout';
export type { StackProps } from './Layout';

export { Background, type BackgroundProps } from './Background';
export { HlsVideo, type HlsVideoProps } from './HlsVideo';

export {
  GlassCard,
  IconButton,
  Chip,
  Input,
  Divider,
  Avatar,
  Stat,
  LoadingSkeleton,
} from './Components';
export type {
  GlassCardProps,
  IconButtonProps,
  ChipProps,
  InputProps,
  AvatarProps,
  StatProps,
} from './Components';

export { Tooltip, TooltipProvider, TooltipRoot, TooltipTrigger, TooltipContent } from './Tooltip';
export type { TooltipProps } from './Tooltip';

export { SmoothScroll } from './SmoothScroll';
