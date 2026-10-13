import { Box } from '@mui/material';
import type { ReactNode } from 'react';

import { fonts, glow, palette } from '../theme';

/** "Cella" in the brand script. */
export function Logo({ size = 32, short = false }: { size?: number; short?: boolean }) {
  return (
    <Box
      component="span"
      sx={{ fontFamily: fonts.logo, fontWeight: 700, fontSize: size, lineHeight: 1 }}
    >
      {short ? 'C' : 'Cella'}
    </Box>
  );
}

/** White rounded card; `highlight` adds the blue glow (one per screen). */
export function Card({
  children,
  highlight = false,
  padding = 2.5,
}: {
  children: ReactNode;
  highlight?: boolean;
  padding?: number;
}) {
  return (
    <Box
      sx={{
        borderRadius: '30px',
        bgcolor: palette.surface,
        backgroundImage: highlight ? glow : undefined,
        p: padding,
        minWidth: 0,
      }}
    >
      {children}
    </Box>
  );
}

/** Large light number with a smaller, faded suffix: 15 items, $61.80, 2 L. */
export function BigNumber({
  value,
  suffix,
  size = 76,
}: {
  value: ReactNode;
  suffix?: ReactNode;
  size?: number;
}) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75 }}>
      <Box
        component="span"
        sx={{ fontSize: size, fontWeight: 400, letterSpacing: '-0.05em', lineHeight: 0.9 }}
      >
        {value}
      </Box>
      {suffix !== undefined && (
        <Box
          component="span"
          sx={{ fontSize: Math.max(14, size * 0.22), color: palette.textMuted }}
        >
          {suffix}
        </Box>
      )}
    </Box>
  );
}

/** Money with the cents drawn lighter. */
export function Money({ parts }: { parts: [string, string] }) {
  return (
    <span>
      {parts[0]}
      <Box component="span" sx={{ color: palette.textFaint }}>
        {parts[1]}
      </Box>
    </span>
  );
}

/** Row of rounded segments; `strong` ones in navy, `soft` in steel, the rest empty. */
export function SegmentBar({
  strong,
  soft,
  total,
  height = 22,
  label,
}: {
  strong: number;
  soft: number;
  total: number;
  height?: number;
  label: string;
}) {
  const count = Math.max(total, 1);
  return (
    <Box
      role="img"
      aria-label={label}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
        gap: count > 20 ? '3px' : '5px',
      }}
    >
      {Array.from({ length: count }, (_, index) => (
        <Box
          key={index}
          sx={{
            height,
            borderRadius: `${Math.min(8, height / 3)}px`,
            bgcolor:
              index < strong ? palette.navy : index < strong + soft ? palette.steel : palette.track,
          }}
        />
      ))}
    </Box>
  );
}

/** Thin ring showing a percentage. */
export function StockRing({
  percent,
  warn,
  size = 32,
}: {
  percent: number;
  warn: boolean;
  size?: number;
}) {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const filled = (circumference * Math.max(0, Math.min(percent, 100))) / 100;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={radius} fill="none" stroke={palette.track} strokeWidth="3.5" />
      <circle
        cx="18"
        cy="18"
        r={radius}
        fill="none"
        stroke={warn ? palette.navyMid : palette.navy}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

/** Inline stroke icons (one set, same weight everywhere). */
const ICONS = {
  home: 'M4 11l8-7 8 7v9H4z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  products: 'M4 7l8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10',
  markets: 'M4 9l1.5-5h13L20 9M4 9h16v11H4zM9 20v-6h6v6',
  history: 'M12 7v5l3 2M3.5 12a8.5 8.5 0 1 0 2.5-6M3 4v4h4',
  search: 'M11 4.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM20 20l-4-4',
  back: 'M15 6l-6 6 6 6',
  arrow: 'M7 17L17 7M8 7h9v9',
  panel: 'M6.5 4.5h11a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-11a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3zM9.5 4.5v15',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10',
  plus: 'M12 5v14M5 12h14',
  tour: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l5 3.5-5 3.5z',
  next: 'M5 12h14M13 6l6 6-6 6',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
