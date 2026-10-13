import { Alert, Box, Button, TextField } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/ui';
import { glow, palette } from '../theme';

const PASSWORD_MIN = 8;

/** Opened from an invite link (/join/CODE): create an account inside that household. */
export function JoinPage() {
  const { t } = useTranslation();
  const { join } = useAuth();
  const navigate = useNavigate();
  const { code = '' } = useParams();
  const [form, setForm] = useState({ name: '', email: '', password: '', inviteCode: code });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: { target: { value: string } }) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.password.length < PASSWORD_MIN) {
      setError(t('join.passwordShort', { count: PASSWORD_MIN }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await join({ ...form, inviteCode: form.inviteCode.trim() });
      navigate('/', { replace: true });
    } catch (caught) {
      const status = caught instanceof ApiError ? caught.status : 0;
      setError(
        status === 404
          ? t('join.codeNotFound')
          : status === 409
            ? t('join.emailTaken')
            : status === 422
              ? t('join.invalid')
              : t('errors.offline'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        bgcolor: palette.canvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 1.5,
      }}
    >
      <Box
        sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 1.5 }}
      >
        <Box sx={{ textAlign: 'center', mb: 2, color: palette.navy }}>
          <Logo size={56} />
        </Box>
        <Box
          component="form"
          onSubmit={submit}
          sx={{
            p: 3,
            borderRadius: '30px',
            bgcolor: palette.surface,
            backgroundImage: glow,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box component="h1" sx={{ m: 0, fontSize: 22, fontWeight: 500 }}>
            {t('join.title')}
          </Box>
          <Box component="p" sx={{ m: 0, color: palette.textMuted, fontSize: 14 }}>
            {t('join.text')}
          </Box>
          <TextField label={t('join.name')} autoComplete="name" required {...field('name')} />
          <TextField
            label={t('login.email')}
            type="email"
            autoComplete="email"
            required
            {...field('email')}
          />
          <TextField
            label={t('login.password')}
            type="password"
            autoComplete="new-password"
            required
            helperText={t('join.passwordHint', { count: PASSWORD_MIN })}
            {...field('password')}
          />
          <TextField label={t('join.code')} required {...field('inviteCode')} />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? '…' : t('join.submit')}
          </Button>
        </Box>
        {error && (
          <Alert severity="error" role="alert" sx={{ borderRadius: '18px' }}>
            {error}
          </Alert>
        )}
        <Button component={RouterLink} to="/login" sx={{ color: palette.textMuted }}>
          {t('join.haveAccount')}
        </Button>
      </Box>
    </Box>
  );
}
