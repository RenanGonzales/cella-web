import { Box, Dialog } from '@mui/material';
import type { ReactNode } from 'react';

import { palette } from '../../theme';

/** Dialog that sits at the bottom on phones (reachable with one thumb), centered on desktop. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  actions,
  wide = false,
}: {
  wide?: boolean;
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={wide ? 'sm' : 'xs'}
      aria-labelledby="sheet-title"
      sx={{ '& .MuiDialog-container': { alignItems: { xs: 'flex-end', sm: 'center' } } }}
      slotProps={{
        paper: {
          sx: {
            m: 1.5,
            width: 'calc(100% - 24px)',
            borderRadius: '30px',
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2.5,
          },
        },
      }}
    >
      <Box
        component="h2"
        id="sheet-title"
        sx={{ m: 0, fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: palette.navy }}
      >
        {title}
      </Box>
      {children}
      {actions && <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>{actions}</Box>}
    </Dialog>
  );
}
