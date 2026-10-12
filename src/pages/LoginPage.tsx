import { Alert, Box, Button, Divider, TextField } from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/ui';
import { introSeen } from '../lib/intro';
import { glow, palette } from '../theme';

export function LoginPage() {
  const { t } = useTranslation();
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'login' | 'demo' | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy('login');
    setError(null);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 401
          ? t('login.failed')
          : t('errors.offline'),
      );
    } finally {
      setBusy(null);
    }
  };

  const demo = async () => {
    setBusy('demo');
    setError(null);
    try {
      await loginDemo();
      navigate(introSeen() ? '/' : '/welcome', { replace: true });
    } catch {
      setError(t('login.demoFailed'));
    } finally {
      setBusy(null);
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
          <Box component="p" sx={{ m: 0, mt: 1, color: palette.textMuted }}>
            {t('app.tagline')}
          </Box>
        </Box>

        <Box
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
          <Button variant="contained" size="large" onClick={demo} disabled={busy !== null}>
            {busy === 'demo' ? '…' : t('login.demo')}
          </Button>
          <Box
            component="p"
            sx={{ m: 0, textAlign: 'center', fontSize: 13, color: palette.textMuted }}
          >
            {t('login.demoHint')}
          </Box>
        </Box>

        <Divider
          sx={{
            my: 1,
            color: palette.textFaint,
            fontSize: 13,
            '&::before, &::after': { borderColor: palette.track },
          }}
        >
          {t('login.or')}
        </Divider>

        <Box
          component="form"
          onSubmit={submit}
          sx={{
            p: 3,
            borderRadius: '30px',
            bgcolor: palette.surface,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          <Box component="h1" sx={{ m: 0, fontSize: 22, fontWeight: 500 }}>
            {t('login.title')}
          </Box>
          <TextField
            label={t('login.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            type="submit"
            size="large"
            disabled={busy !== null}
            sx={{ bgcolor: palette.canvas, color: palette.navy }}
          >
            {busy === 'login' ? '…' : t('login.submit')}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" role="alert" sx={{ borderRadius: '18px' }}>
            {error}
          </Alert>
        )}
      </Box>
    </Box>
  );
}
