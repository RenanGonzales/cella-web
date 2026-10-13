import { Button, TextField } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Market, MarketInput } from '../../api/types';
import { palette } from '../../theme';
import { Sheet } from '../list/Sheet';

/** Create or edit a market: its name and, optionally, chain and address. */
export function MarketDialog({
  market,
  busy,
  onClose,
  onSave,
  onArchive,
  onRestore,
}: {
  /** Null for a new market. */
  market: Market | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: MarketInput) => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(market?.name ?? '');
  const [chain, setChain] = useState(market?.chain ?? '');
  const [address, setAddress] = useState(market?.address ?? '');
  const [nameError, setNameError] = useState(false);

  const save = () => {
    if (!name.trim()) return setNameError(true);
    onSave({ name: name.trim(), chain: chain.trim() || null, address: address.trim() || null });
  };
  const archived = market?.archived_at != null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={market ? market.name : t('markets.newTitle')}
      actions={
        <>
          {market &&
            (archived ? (
              <Button onClick={onRestore} disabled={busy} sx={{ mr: 'auto' }}>
                {t('products.restore')}
              </Button>
            ) : (
              <Button
                onClick={onArchive}
                disabled={busy}
                sx={{ mr: 'auto', color: palette.textMuted }}
              >
                {t('products.archive')}
              </Button>
            ))}
          <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
            {t('list.close')}
          </Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {t('list.save')}
          </Button>
        </>
      }
    >
      <TextField
        label={t('markets.fields.name')}
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          setNameError(false);
        }}
        error={nameError}
        helperText={nameError ? t('markets.errors.name') : ' '}
        autoFocus={!market}
      />
      <TextField
        label={t('markets.fields.chain')}
        value={chain}
        onChange={(event) => setChain(event.target.value)}
      />
      <TextField
        label={t('markets.fields.address')}
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />
    </Sheet>
  );
}
