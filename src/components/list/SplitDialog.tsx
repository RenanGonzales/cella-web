import { Box, Button } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Member } from '../../api/types';
import { palette } from '../../theme';
import { Pill } from './ItemDialog';
import { Sheet } from './Sheet';

/** Who is at the market. The first person takes the first corridors. */
export function SplitDialog({
  members,
  busy,
  onClose,
  onSplit,
}: {
  /** Household members, the person using the app first. */
  members: Member[];
  busy: boolean;
  onClose: () => void;
  onSplit: (userIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState(() => members.map((member) => member.id));

  const toggle = (id: string) =>
    setChosen((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));
  // Keep the household order (you first), whatever order they were tapped in.
  const ordered = members.map((member) => member.id).filter((id) => chosen.includes(id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={t('list.splitTitle')}
      actions={
        <>
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.close')}
          </Button>
          <Button
            variant="contained"
            disabled={ordered.length === 0 || busy}
            data-tour="split-confirm"
            onClick={() => onSplit(ordered)}
          >
            {t('list.splitConfirm')}
          </Button>
        </>
      }
    >
      <Box component="p" sx={{ m: 0, color: palette.textMuted, fontSize: 14 }}>
        {t('list.splitHint')}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {members.map((member) => (
          <Pill
            key={member.id}
            role="checkbox"
            selected={chosen.includes(member.id)}
            onClick={() => toggle(member.id)}
          >
            {member.name}
          </Pill>
        ))}
      </Box>
    </Sheet>
  );
}
