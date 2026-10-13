import { Box, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';

import { partnerStore } from '../api/client';
import { Logo } from '../components/ui';
import { canShowTwoPhones, useTourState } from '../lib/tour';
import { palette } from '../theme';

const SCREEN_WIDTH = 390;
const SCREEN_HEIGHT = 844;
const STATUS_BAR = 44;
const BEZEL = 12;
const FRAME_WIDTH = SCREEN_WIDTH + BEZEL * 2;
const FRAME_HEIGHT = SCREEN_HEIGHT + BEZEL * 2;
/** Room for the title above the phones and the names below them. */
const CHROME_HEIGHT = 200;

function fitScale(): number {
  return Math.min(1, Math.max(0.5, (window.innerHeight - CHROME_HEIGHT) / FRAME_HEIGHT));
}

/**
 * Two phones side by side, Alex's and Sam's, each running the real app with its own
 * session: what one of them ticks shows up on the other within seconds.
 */
export function DemoPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const tour = useTourState();
  const [scale, setScale] = useState(fitScale);

  useEffect(() => {
    const onResize = () => setScale(fitScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Small screens and real accounts (no Sam) have no two-phone page.
  if (!canShowTwoPhones() || partnerStore.get() === null) return <Navigate to="/list" replace />;

  const base = import.meta.env.BASE_URL;
  // During the tour, Sam's phone stays dim except while he is the one to watch.
  const dimSam = tour !== null && tour.step !== 'sam';

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        bgcolor: palette.canvas,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        px: 4,
        py: 3,
        gap: 3,
      }}
    >
      <Box
        component="header"
        sx={{
          width: '100%',
          maxWidth: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <Logo size={34} />
          <Box>
            <Box
              component="h1"
              sx={{ m: 0, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}
            >
              {t('demo.title')}
            </Box>
            <Box component="p" sx={{ m: 0, color: palette.textMuted, fontSize: 14 }}>
              {t('demo.subtitle')}
            </Box>
          </Box>
        </Box>
        <Button onClick={() => navigate('/')} sx={{ bgcolor: palette.surface, px: 2.5 }}>
          {t('demo.back')}
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <Phone
          scale={scale}
          src={`${base}list`}
          title={t('demo.alexPhone')}
          label={t('demo.alexLabel')}
        />
        <Phone
          scale={scale}
          src={`${base}list?as=sam`}
          title={t('demo.samPhone')}
          label={t('demo.samLabel')}
          dim={dimSam}
        />
      </Box>
    </Box>
  );
}

/** A generic phone: navy frame, status bar, and the app running inside. */
function Phone({
  scale,
  src,
  title,
  label,
  dim = false,
}: {
  scale: number;
  src: string;
  title: string;
  label: string;
  dim?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}>
        <Box
          sx={{
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            p: `${BEZEL}px`,
            boxSizing: 'border-box',
            borderRadius: '62px',
            bgcolor: palette.navy,
            boxShadow: '0 30px 70px rgba(11,37,69,0.28), inset 0 0 0 2px rgba(255,255,255,0.08)',
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
              borderRadius: '50px',
              overflow: 'hidden',
              bgcolor: palette.canvas,
            }}
          >
            <StatusBar />
            <Box
              component="iframe"
              src={src}
              title={title}
              sx={{
                display: 'block',
                border: 0,
                width: SCREEN_WIDTH,
                height: SCREEN_HEIGHT - STATUS_BAR,
              }}
            />
            <Box
              aria-hidden="true"
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(11, 37, 69, 0.55)',
                opacity: dim ? 1 : 0,
                pointerEvents: dim ? 'auto' : 'none',
                transition: 'opacity .4s ease',
              }}
            />
          </Box>
        </Box>
      </Box>
      <Box sx={{ fontSize: 15, fontWeight: 500, color: palette.navy }}>{label}</Box>
    </Box>
  );
}

/** Time, camera island and generic signal/battery marks: just enough to read as a phone. */
function StatusBar() {
  return (
    <Box
      aria-hidden="true"
      sx={{
        height: STATUS_BAR,
        px: 3.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 15,
        fontWeight: 600,
        color: palette.navy,
        position: 'relative',
      }}
    >
      <span>9:41</span>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: 10,
          transform: 'translateX(-50%)',
          width: 104,
          height: 28,
          borderRadius: 14,
          bgcolor: palette.navy,
        }}
      />
      <svg width="58" height="12" viewBox="0 0 58 12" fill={palette.navy}>
        <rect x="0" y="8" width="3" height="4" rx="1" />
        <rect x="5" y="6" width="3" height="6" rx="1" />
        <rect x="10" y="3" width="3" height="9" rx="1" />
        <rect x="15" y="0" width="3" height="12" rx="1" />
        <rect
          x="30"
          y="1"
          width="23"
          height="10"
          rx="3"
          fill="none"
          stroke={palette.navy}
          strokeWidth="1.2"
        />
        <rect x="32" y="3" width="16" height="6" rx="1.5" />
        <rect x="54.5" y="4" width="2" height="4" rx="1" />
      </svg>
    </Box>
  );
}
