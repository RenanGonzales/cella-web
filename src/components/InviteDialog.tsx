import { Alert, Box, Button } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Me } from '../api/types';
import { inviteLink } from '../lib/invite';
import { palette } from '../theme';
import { Sheet } from './list/Sheet';
import { Icon } from './ui';

/** The household's invite code and link. Demo copies cannot be joined (they expire). */
export function InviteDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const code = me.household.invite_code;
  const link = inviteLink(code);
  const demo = me.features.is_demo;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('invite.title', { household: me.household.name })}
      actions={
        <Button variant="contained" onClick={onClose}>
          {t('invite.done')}
        </Button>
      }
    >
      <Box sx={{ color: palette.textSoft }}>{t('invite.text')}</Box>
      <Box
        aria-label={t('nav.invite')}
        sx={{
          p: 2,
          borderRadius: '18px',
          bgcolor: palette.canvas,
          textAlign: 'center',
          fontSize: 30,
          letterSpacing: '0.12em',
          fontWeight: 500,
        }}
      >
        {code}
      </Box>
      {demo ? (
        <Alert severity="info" sx={{ borderRadius: '18px' }}>
          {t('invite.demo')}
        </Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box
            sx={{ fontSize: 13, color: palette.textMuted, wordBreak: 'break-all' }}
            data-testid="invite-link"
          >
            {link}
          </Box>
          <Button
            variant="outlined"
            startIcon={<Icon name={copied ? 'check' : 'link'} size={20} />}
            onClick={() => void copy()}
            sx={{ alignSelf: 'flex-start' }}
          >
            {copied ? t('invite.copied') : t('invite.copy')}
          </Button>
        </Box>
      )}
    </Sheet>
  );
}
