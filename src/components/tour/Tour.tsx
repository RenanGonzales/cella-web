import { keyframes } from '@emotion/react';
import { Box, Button } from '@mui/material';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { persona } from '../../api/client';
import { runSam } from '../../lib/samBot';
import { goToStep, onTourEvent, stopTour, useTourState } from '../../lib/tour';
import type { TourState } from '../../lib/tour';
import { palette } from '../../theme';
import { tourSteps } from './steps';

/** Above MUI dialogs, menus and snackbars, so the veil also dims them. */
const Z = 1450;
const VEIL = 'rgba(11, 37, 69, 0.72)';
const HOLE_PADDING = 6;
const CARD_WIDTH = 340;
const GAP = 14;
/** After this long without its spot on screen, a step offers "Next" so nobody gets stuck. */
const LOST_AFTER_MS = 5000;
/** Time for Sam's last tick to reach this phone (the list refreshes every 3 s). */
const SYNC_MS = 3200;

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(201, 217, 234, 0.7); }
  70%  { box-shadow: 0 0 0 12px rgba(201, 217, 234, 0); }
  100% { box-shadow: 0 0 0 0 rgba(201, 217, 234, 0); }
`;

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** The last of the step's spots that is on screen (a menu item beats the menu button). */
function findTarget(names: string[]): HTMLElement | null {
  for (const name of [...names].reverse()) {
    const element = document.querySelector<HTMLElement>(`[data-tour="${name}"]`);
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

interface Hole {
  top: number;
  left: number;
  width: number;
  height: number;
  radius: number;
}

function sameHole(a: Hole | null, b: Hole | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5 &&
    a.radius === b.radius
  );
}

/**
 * Guided tour of the demo: the screen goes dark except the one spot to look at or tap,
 * with a caption explaining it. Only that spot can be clicked.
 */
export function Tour() {
  const state = useTourState();
  // Sam's frame never runs the tour: it is driven from Alex's.
  if (!state || persona !== 'main') return null;
  return (
    <TourLayer>
      <TourStepView key={state.step} state={state} />
    </TourLayer>
  );
}

/**
 * The tour lives in its own layer at the end of <body>. MUI dialogs hide everything
 * else from screen readers while open (aria-hidden on their siblings); the caption must
 * stay readable on top of them, so this layer refuses that attribute.
 */
function TourLayer({ children }: { children: ReactNode }) {
  const [layer] = useState(() => {
    const element = document.createElement('div');
    element.dataset.layer = 'cella-tour';
    return element;
  });
  useEffect(() => {
    document.body.appendChild(layer);
    const observer = new MutationObserver(() => {
      if (layer.hasAttribute('aria-hidden')) layer.removeAttribute('aria-hidden');
    });
    observer.observe(layer, { attributes: true, attributeFilter: ['aria-hidden'] });
    return () => {
      observer.disconnect();
      layer.remove();
    };
  }, [layer]);
  return createPortal(children, layer);
}

function TourStepView({ state }: { state: TourState }) {
  const { t } = useTranslation();
  const steps = useMemo(() => tourSteps(state.wide), [state.wide]);
  const index = steps.findIndex((candidate) => candidate.id === state.step);
  const step = steps[index];
  const targetNames = step?.targets.join('|') ?? '';

  const [hole, setHole] = useState<Hole | null>(null);
  const [lost, setLost] = useState(false);
  const target = useRef<HTMLElement | null>(null);

  const next = () => {
    if (!step) return;
    if (step.id === 'two-phones') {
      // The tour goes on inside Alex's frame, on the page with both phones.
      goToStep('everyone');
      window.location.assign(`${import.meta.env.BASE_URL}demo`);
      return;
    }
    const following = steps[index + 1];
    if (following) goToStep(following.id);
    else stopTour();
  };
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  });

  // Follow the spot: it can appear late, move with scrolling, or change (menu -> dialog).
  useEffect(() => {
    if (!targetNames) return;
    const names = targetNames.split('|');
    const startedAt = Date.now();
    let last: HTMLElement | null = null;
    const tick = () => {
      const element = findTarget(names);
      target.current = element;
      if (!element) {
        setHole(null);
        if (Date.now() - startedAt > LOST_AFTER_MS) setLost(true);
        return;
      }
      setLost(false);
      if (element !== last) {
        element.scrollIntoView?.({
          block: last ? 'nearest' : 'center',
          behavior: reducedMotion() ? 'auto' : 'smooth',
        });
        last = element;
      }
      const rect = element.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(element).borderTopLeftRadius) || 12;
      const nextHole = {
        top: rect.top - HOLE_PADDING,
        left: rect.left - HOLE_PADDING,
        width: rect.width + HOLE_PADDING * 2,
        height: rect.height + HOLE_PADDING * 2,
        radius: Math.min(radius + HOLE_PADDING, (rect.height + HOLE_PADDING * 2) / 2),
      };
      setHole((previous) => (sameHole(previous, nextHole) ? previous : nextHole));
    };
    tick();
    const timer = window.setInterval(tick, 150);
    return () => window.clearInterval(timer);
  }, [targetNames]);

  // "Tap here" steps: move on right after the app has handled the tap.
  useEffect(() => {
    if (step?.advance !== 'click') return;
    const onClick = (event: MouseEvent) => {
      const element = target.current;
      if (element && event.target instanceof Node && element.contains(event.target)) {
        window.setTimeout(() => nextRef.current(), 0);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [step?.advance]);

  // Steps finished by the app itself: consumed, started, split, checked out.
  useEffect(() => {
    if (step?.advance !== 'event') return;
    return onTourEvent((name) => name === step.event && nextRef.current());
  }, [step?.advance, step?.event]);

  // Sam shops his part while Alex watches.
  const [sam, setSam] = useState<{ done: number; total: number } | null>(null);
  const [samFinished, setSamFinished] = useState(false);
  useEffect(() => {
    if (step?.id !== 'sam') return;
    let cancelled = false;
    let timer = 0;
    runSam(
      (done, total) => setSam({ done, total }),
      () => cancelled,
    )
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) timer = window.setTimeout(() => setSamFinished(true), SYNC_MS);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [step?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && stopTour();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Unknown step (e.g. an old saved tour): end it.
  useEffect(() => {
    if (!step) stopTour();
  }, [step]);

  const card = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(200);
  useLayoutEffect(() => {
    if (card.current) setCardHeight(card.current.offsetHeight);
  }, [hole, lost, sam, samFinished]);

  if (!step) return null;

  const waitingForSam = step.id === 'sam' && !samFinished;
  const showNext = (step.advance === 'next' || lost) && !waitingForSam;
  const isLast = index === steps.length - 1;
  const position = cardPosition(hole, cardHeight);
  const blockers = hole ? blockerRects(hole) : [{ top: 0, left: 0, right: 0, bottom: 0 }];

  return (
    <>
      <Box
        component="svg"
        aria-hidden="true"
        sx={{
          position: 'fixed',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: Z,
          pointerEvents: 'none',
        }}
      >
        <defs>
          <mask id="cella-tour-hole">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={hole.radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill={VEIL} mask="url(#cella-tour-hole)" />
      </Box>

      {blockers.map((rect, position) => (
        <Box
          key={position}
          data-testid="tour-blocker"
          sx={{ position: 'fixed', zIndex: Z, ...rect }}
        />
      ))}

      {hole && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'fixed',
            zIndex: Z,
            pointerEvents: 'none',
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            borderRadius: `${hole.radius}px`,
            border: `2px solid ${palette.ice}`,
            animation: reducedMotion() ? 'none' : `${pulse} 1.8s ease-out infinite`,
            transition: 'all .2s ease',
          }}
        />
      )}

      <Box
        ref={card}
        role="dialog"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        sx={{
          position: 'fixed',
          zIndex: Z + 1,
          ...position,
          p: 2.5,
          borderRadius: '26px',
          bgcolor: palette.surface,
          color: palette.navy,
          boxShadow: '0 18px 50px rgba(11,37,69,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.25,
        }}
      >
        <Box sx={{ fontSize: 12, color: palette.textFaint, letterSpacing: '0.02em' }}>
          {t('tour.counter', { current: index + 1, total: steps.length })}
        </Box>
        <Box
          component="h2"
          id="tour-title"
          aria-live="polite"
          sx={{ m: 0, fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}
        >
          {t(`tour.${step.id}.title`)}
        </Box>
        <Box
          component="p"
          id="tour-text"
          sx={{ m: 0, fontSize: 14, lineHeight: 1.55, color: palette.textSoft }}
        >
          {t(`tour.${step.id}.text`)}
        </Box>

        {waitingForSam && (
          <Box sx={{ fontSize: 13, color: palette.navyMid }} aria-live="polite">
            {sam && sam.done < sam.total
              ? t('tour.samProgress', { done: sam.done, total: sam.total })
              : t('tour.samSync')}
          </Box>
        )}
        {!showNext && !waitingForSam && (
          <Box sx={{ fontSize: 13, color: palette.navyMid }}>{t('tour.tapHint')}</Box>
        )}

        <Box
          sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}
        >
          {isLast ? (
            <span />
          ) : (
            <Button onClick={stopTour} sx={{ color: palette.textMuted, px: 1.5 }}>
              {t('tour.skip')}
            </Button>
          )}
          {showNext && (
            <Button variant="contained" onClick={next} autoFocus>
              {isLast ? t('tour.explore') : t('tour.next')}
            </Button>
          )}
        </Box>
      </Box>
    </>
  );
}

/** Four transparent panels around the spot: they swallow every click except on it. */
function blockerRects(hole: Hole) {
  const right = hole.left + hole.width;
  const bottom = hole.top + hole.height;
  return [
    { top: 0, left: 0, right: 0, height: Math.max(hole.top, 0) },
    { top: bottom, left: 0, right: 0, bottom: 0 },
    { top: hole.top, left: 0, width: Math.max(hole.left, 0), height: hole.height },
    { top: hole.top, left: right, right: 0, height: hole.height },
  ];
}

/** Caption next to the spot on large screens; at the top or bottom edge on phones. */
function cardPosition(hole: Hole | null, cardHeight: number) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const narrow = width < 600;

  if (!hole) {
    return narrow
      ? { left: 12, right: 12, bottom: 12 }
      : {
          width: CARD_WIDTH,
          left: (width - CARD_WIDTH) / 2,
          top: Math.max(GAP, (height - cardHeight) / 2),
        };
  }
  if (narrow) {
    const holeCenter = hole.top + hole.height / 2;
    return holeCenter > height / 2
      ? { left: 12, right: 12, top: 12 }
      : { left: 12, right: 12, bottom: 12 };
  }

  const left = Math.min(Math.max(GAP, hole.left), width - CARD_WIDTH - GAP);
  const below = hole.top + hole.height + GAP;
  if (below + cardHeight <= height - GAP) return { width: CARD_WIDTH, left, top: below };
  const above = hole.top - GAP - cardHeight;
  if (above >= GAP) return { width: CARD_WIDTH, left, top: above };
  // Tall spot: beside it, on the side with more room.
  const roomRight = width - (hole.left + hole.width);
  const sideLeft =
    roomRight >= CARD_WIDTH + GAP * 2
      ? hole.left + hole.width + GAP
      : Math.max(GAP, hole.left - CARD_WIDTH - GAP);
  return {
    width: CARD_WIDTH,
    left: sideLeft,
    top: Math.min(Math.max(GAP, hole.top), height - cardHeight - GAP),
  };
}
