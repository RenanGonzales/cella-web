import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { palette } from '../theme';

/** Placeholder for screens that arrive in the next versions. */
export function SoonPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: { xs: 1, md: 0 } }}>
      <Box
        component="h1"
        sx={{ m: 0, fontSize: { xs: 34, md: 40 }, fontWeight: 500, letterSpacing: '-0.03em' }}
      >
        {t(titleKey)}
      </Box>
      <Box sx={{ p: 3, borderRadius: '30px', bgcolor: palette.surface }}>
        <Box sx={{ fontWeight: 500 }}>{t('soon.title')}</Box>
        <Box sx={{ color: palette.textMuted }}>{t('soon.text')}</Box>
      </Box>
    </Box>
  );
}
