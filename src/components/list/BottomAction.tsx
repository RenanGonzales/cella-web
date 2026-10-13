import { Box, ButtonBase } from '@mui/material';

import { useFocused } from '../FocusMode';
import { palette } from '../../theme';
import { Icon } from '../ui';

/** The screen's main action: a wide navy pill at the bottom, within thumb reach. */
export function BottomAction({
  label,
  onClick,
  disabled = false,
  tourId,
}: {
  tourId?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const focused = useFocused();
  return (
    <>
      {/* Room under the content, so the fixed button never covers the last item. */}
      <Box aria-hidden="true" sx={{ height: { xs: focused ? 72 : 80, md: 0 } }} />
      <Box
        sx={{
          position: { xs: 'fixed', md: 'sticky' },
          left: { xs: 12 },
          right: { xs: 12 },
          bottom: {
            xs: `calc(${focused ? 20 : 92}px + env(safe-area-inset-bottom))`,
            md: 24,
          },
          zIndex: 9,
          width: { md: '100%' },
          maxWidth: { md: 480 },
          ml: { md: 'auto' },
          mt: { md: 1 },
        }}
      >
        <ButtonBase
          onClick={onClick}
          disabled={disabled}
          data-tour={tourId}
          sx={{
            width: '100%',
            height: 60,
            borderRadius: 999,
            bgcolor: palette.navy,
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'space-between',
            pl: 3,
            pr: 1.25,
            boxShadow: '0 10px 30px rgba(11,37,69,0.22)',
            '&.Mui-disabled': { bgcolor: palette.steel, color: '#FFFFFF' },
          }}
        >
          {label}
          <Box
            component="span"
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              bgcolor: 'rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="next" size={20} />
          </Box>
        </ButtonBase>
      </Box>
    </>
  );
}
