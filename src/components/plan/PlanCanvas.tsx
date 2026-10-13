import { Box } from '@mui/material';
import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';

import type { Piece, Plan, RouteDrawing } from '../../lib/plan';
import { palette } from '../../theme';

const FILLS: Record<Piece['kind'], { bg: string; fg: string; radius: number }> = {
  aisle: { bg: palette.steel, fg: '#FFFFFF', radius: 0.32 },
  wall: { bg: palette.ice, fg: palette.navy, radius: 0.32 },
  island: { bg: palette.frost, fg: palette.navy, radius: 0.48 },
  entrance: { bg: palette.navy, fg: '#FFFFFF', radius: 0.32 },
  checkout: { bg: palette.track, fg: palette.navy, radius: 0.32 },
};

export interface CanvasHandlers {
  /** Click or tap: select (with Shift/Ctrl/Cmd: add to the selection). */
  onPick: (key: string, additive: boolean) => void;
  /** Move the selection by whole cells; false when blocked. */
  onMove: (dx: number, dy: number) => boolean;
  /** Grow or shrink the selected piece by whole cells; false when blocked. */
  onResize: (dw: number, dh: number) => boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onClear: () => void;
}

/**
 * The floor plan on a dotted grid. Pieces are buttons: drag to move, drag the corner
 * handle to resize, or use the keyboard (arrows move, Shift + arrows resize).
 */
export function PlanCanvas({
  plan,
  cell,
  selected,
  drawing,
  stopNumbers,
  dimOthers = false,
  readOnly = false,
  handlers,
}: {
  plan: Plan;
  cell: number;
  selected: string[];
  drawing: RouteDrawing;
  stopNumbers: Map<string, number>;
  /** Route mode: pieces that are not stops fade out. */
  dimOthers?: boolean;
  readOnly?: boolean;
  handlers?: CanvasHandlers;
}) {
  const { t } = useTranslation();
  const drag = useRef<{
    kind: 'move' | 'resize';
    x: number;
    y: number;
    applied: [number, number];
  } | null>(null);

  const width = plan.cols * cell;
  const height = plan.rows * cell;
  const single = selected.length === 1 ? plan.pieces.find((p) => p.key === selected[0]) : undefined;

  const start = (event: PointerEvent, kind: 'move' | 'resize') => {
    drag.current = { kind, x: event.clientX, y: event.clientY, applied: [0, 0] };
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };

  const follow = (event: PointerEvent) => {
    const current = drag.current;
    if (!current || !handlers) return;
    const dx = Math.round((event.clientX - current.x) / cell);
    const dy = Math.round((event.clientY - current.y) / cell);
    const [ax, ay] = current.applied;
    if (dx === ax && dy === ay) return;
    const done =
      current.kind === 'move'
        ? handlers.onMove(dx - ax, dy - ay)
        : handlers.onResize(dx - ax, dy - ay);
    if (done) current.applied = [dx, dy];
  };

  const stop = () => {
    drag.current = null;
  };

  const onKey = (event: KeyboardEvent) => {
    if (!handlers) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const step = arrows[event.key];
    if (step) {
      event.preventDefault();
      if (event.shiftKey) handlers.onResize(step[0], step[1]);
      else handlers.onMove(step[0], step[1]);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      handlers.onDelete();
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      handlers.onDuplicate();
    } else if (event.key === 'Escape') {
      handlers.onClear();
    }
  };

  return (
    <Box
      role="group"
      aria-label={t('plan.canvas')}
      onPointerDown={(event: PointerEvent) => {
        // A tap on the empty floor clears the selection.
        if (event.target === event.currentTarget) handlers?.onClear();
      }}
      sx={{
        position: 'relative',
        width,
        height,
        mx: 'auto',
        borderRadius: '18px',
        bgcolor: '#F6F7FA',
        backgroundImage: `radial-gradient(circle, #D3D9E3 1.2px, transparent 1.4px)`,
        backgroundSize: `${cell}px ${cell}px`,
        backgroundPosition: `${cell / 2}px ${cell / 2}px`,
        touchAction: readOnly ? 'auto' : 'none',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {plan.pieces.map((piece) => {
        const fill = FILLS[piece.kind];
        const isSelected = selected.includes(piece.key);
        const stopNumber = stopNumbers.get(piece.key);
        const vertical = piece.h > piece.w && piece.w < 2;
        const inset = Math.max(2, cell * 0.08);
        const common = {
          position: 'absolute' as const,
          left: piece.x * cell + inset,
          top: piece.y * cell + inset,
          width: piece.w * cell - inset * 2,
          height: piece.h * cell - inset * 2,
          borderRadius: `${Math.round(cell * fill.radius)}px`,
          bgcolor: fill.bg,
          color: fill.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontSize: Math.max(10, Math.min(13, cell * 0.36)),
          fontWeight: 500,
          lineHeight: 1.15,
          textAlign: 'center' as const,
          opacity: dimOthers && !stopNumber ? 0.5 : 1,
          transition: 'left .12s ease, top .12s ease, width .12s ease, height .12s ease',
        };
        const label = (
          <Box
            component="span"
            sx={
              vertical
                ? { writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }
                : { px: 0.5 }
            }
          >
            {piece.name}
          </Box>
        );
        if (readOnly) {
          return (
            <Box key={piece.key} aria-hidden="true" sx={common}>
              {cell >= 24 && label}
            </Box>
          );
        }
        return (
          <Box
            key={piece.key}
            component="button"
            type="button"
            data-piece={piece.key}
            aria-pressed={isSelected}
            aria-label={
              stopNumber ? t('plan.pieceStop', { name: piece.name, n: stopNumber }) : piece.name
            }
            onPointerDown={(event: PointerEvent) => {
              handlers?.onPick(piece.key, event.shiftKey || event.metaKey || event.ctrlKey);
              start(event, 'move');
            }}
            onPointerMove={follow}
            onPointerUp={stop}
            onPointerCancel={stop}
            onKeyDown={onKey}
            sx={{
              ...common,
              border: 'none',
              p: 0,
              font: 'inherit',
              cursor: 'grab',
              zIndex: isSelected ? 2 : 1,
              boxShadow: isSelected
                ? `0 0 0 3px #FFFFFF, 0 0 0 5px ${palette.navy}, 0 10px 24px rgba(11,37,69,0.18)`
                : 'none',
              '&:focus-visible': { outline: `3px solid ${palette.navyMid}`, outlineOffset: 2 },
              '&:active': { cursor: 'grabbing' },
            }}
          >
            {label}
          </Box>
        );
      })}

      <Box
        component="svg"
        aria-hidden="true"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 3 }}
      >
        <polyline
          points={drawing.points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={palette.navy}
          strokeWidth={dimOthers ? 4 : 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`0.1 ${Math.max(6, cell * 0.24)}`}
          opacity={0.85}
        />
      </Box>

      {drawing.badges.map((badge) => {
        const size = Math.max(16, Math.min(24, cell * 0.62));
        return (
          <Box
            key={badge.key}
            aria-hidden="true"
            sx={{
              position: 'absolute',
              zIndex: 4,
              pointerEvents: 'none',
              left: badge.x - size / 2,
              top: badge.y - size / 2,
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: palette.navy,
              color: '#FFFFFF',
              fontSize: size * 0.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 0 2px #FFFFFF',
            }}
          >
            {badge.n}
          </Box>
        );
      })}

      {!readOnly && single && (
        <Box
          role="presentation"
          data-testid="resize-handle"
          onPointerDown={(event: PointerEvent) => {
            event.stopPropagation();
            start(event, 'resize');
          }}
          onPointerMove={follow}
          onPointerUp={stop}
          onPointerCancel={stop}
          sx={{
            position: 'absolute',
            zIndex: 5,
            left: (single.x + single.w) * cell - 11,
            top: (single.y + single.h) * cell - 11,
            width: 18,
            height: 18,
            borderRadius: '50%',
            bgcolor: '#FFFFFF',
            border: `3px solid ${palette.navy}`,
            cursor: 'nwse-resize',
            touchAction: 'none',
          }}
        />
      )}
    </Box>
  );
}
