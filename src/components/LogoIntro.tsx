import { keyframes } from '@emotion/react';
import { Box, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fonts, palette } from '../theme';

const reveal = keyframes`from { stroke-dashoffset: 900; } to { stroke-dashoffset: 0; }`;
const swash = keyframes`from { stroke-dashoffset: 520; } to { stroke-dashoffset: 0; }`;
const drop = keyframes`
  0% { transform: translateY(-120px); opacity: 0; }
  15% { opacity: 1; }
  70% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(0) scale(1.6, 0.4); opacity: 0; }`;
const ripple = keyframes`from { r: 2; opacity: .5; } to { r: 22; opacity: 0; }`;
const rise = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }`;

/** Time until the buttons show; a tap anywhere skips straight to them. */
const INTRO_MS = 4200;

/**
 * Opening of the demo: "Cella" written in ink, a signature swash and a drop, then the
 * choice between the guided tour and exploring alone.
 */
export function LogoIntro({ onTour, onExplore }: { onTour: () => void; onExplore: () => void }) {
  const { t } = useTranslation();
  const [skipped, setSkipped] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), INTRO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const finished = skipped || ready;
  // Skipping jumps every animation to its end state.
  const timing = (duration: string, delay: string) =>
    skipped ? '0.01s 0s' : `${duration} ${delay}`;

  return (
    <Box
      onClick={() => setSkipped(true)}
      sx={{
        minHeight: '100dvh',
        bgcolor: palette.surface,
        color: palette.navy,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        px: 2,
        '@media (prefers-reduced-motion: reduce)': {
          '& *': { animationDuration: '0.01s !important', animationDelay: '0s !important' },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 620 260"
        role="img"
        aria-label="Cella"
        sx={{ width: 'min(620px, 92vw)' }}
      >
        <defs>
          <mask id="cella-ink" maskUnits="userSpaceOnUse" x="0" y="0" width="620" height="260">
            <Box
              component="path"
              d="M-140 120 L 760 120"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={260}
              strokeLinecap="round"
              sx={{
                strokeDasharray: 900,
                strokeDashoffset: 900,
                animation: `${reveal} ${timing('1.9s', '.3s')} cubic-bezier(.55,.05,.35,1) forwards`,
              }}
            />
          </mask>
        </defs>
        <text
          x="310"
          y="170"
          textAnchor="middle"
          mask="url(#cella-ink)"
          style={{ fontFamily: fonts.logo, fontWeight: 700, fontSize: 168, fill: 'currentColor' }}
        >
          Cella
        </text>
        <Box
          component="path"
          d="M150 205 C 250 228, 400 226, 500 196"
          fill="none"
          stroke={palette.navy}
          strokeWidth={5}
          strokeLinecap="round"
          sx={{
            strokeDasharray: 520,
            strokeDashoffset: 520,
            animation: `${swash} ${timing('.9s', '2s')} cubic-bezier(.6,0,.3,1) forwards`,
          }}
        />
        <Box
          component="circle"
          cx="505"
          cy="194"
          r="6"
          fill={palette.navy}
          sx={{
            opacity: 0,
            transformBox: 'fill-box',
            transformOrigin: 'center bottom',
            animation: skipped ? 'none' : `${drop} 1s cubic-bezier(.5,0,.8,.4) 2.7s forwards`,
          }}
        />
        <Box
          component="circle"
          cx="505"
          cy="196"
          r="2"
          fill="none"
          stroke={palette.navy}
          strokeWidth={1.5}
          sx={{ opacity: 0, animation: skipped ? 'none' : `${ripple} .8s ease-out 3.4s forwards` }}
        />
      </Box>

      <Box
        component="p"
        sx={{
          m: 0,
          fontSize: 16,
          color: palette.textMuted,
          opacity: 0,
          animation: `${rise} ${timing('.7s', '3.6s')} ease-out forwards`,
        }}
      >
        {t('app.tagline')}
      </Box>

      <Box
        sx={{
          minHeight: 84,
          mt: 3.5,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1.25,
          justifyContent: 'center',
        }}
      >
        {finished && (
          <>
            <Button
              variant="contained"
              size="large"
              autoFocus
              onClick={(event) => {
                event.stopPropagation();
                onTour();
              }}
              sx={{ pl: 3, pr: 1.25, gap: 1.75, animation: `${rise} .5s ease-out` }}
            >
              {t('intro.takeTour')}
              <Box
                component="span"
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 999,
                  bgcolor: 'rgba(255,255,255,0.16)',
                  fontSize: 13,
                }}
              >
                {t('intro.tourLength')}
              </Box>
            </Button>
            <Button
              size="large"
              onClick={(event) => {
                event.stopPropagation();
                onExplore();
              }}
              sx={{
                bgcolor: palette.canvas,
                color: palette.navy,
                animation: `${rise} .5s ease-out`,
              }}
            >
              {t('intro.explore')}
            </Button>
          </>
        )}
      </Box>
      {!finished && (
        <Box
          component="span"
          sx={{ position: 'fixed', bottom: 24, fontSize: 13, color: palette.textFaint }}
        >
          {t('intro.skip')}
        </Box>
      )}
    </Box>
  );
}
