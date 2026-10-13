import { Box, ButtonBase, IconButton, InputBase, Tooltip, useMediaQuery } from '@mui/material';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';

import { useMe, useProducts } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { areaStats } from '../lib/stats';
import { useRestartTour } from '../lib/useRestartTour';
import { glow, palette, theme } from '../theme';
import { ConsumeProvider } from './ConsumeProvider';
import { FocusModeProvider, useFocused } from './FocusMode';
import { Tour } from './tour/Tour';
import { Icon, Logo } from './ui';
import type { IconName } from './ui';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'nav.home', icon: 'home' },
  { to: '/list', label: 'nav.list', icon: 'list' },
  { to: '/products', label: 'nav.products', icon: 'products' },
  { to: '/markets', label: 'nav.markets', icon: 'markets' },
  { to: '/history', label: 'nav.history', icon: 'history' },
];

const COLLAPSED_KEY = 'cella.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Desktop: collapsible sidebar. Phone: header plus floating bottom navigation. */
export function AppShell() {
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  return (
    <FocusModeProvider>
      <ConsumeProvider>
        <Shell desktop={desktop} />
      </ConsumeProvider>
    </FocusModeProvider>
  );
}

function Shell({ desktop }: { desktop: boolean }) {
  const focused = useFocused();
  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: palette.canvas, display: 'flex' }}>
      {desktop && <Sidebar />}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          px: { xs: 1.5, md: 5 },
          pt: { xs: 0, md: 4 },
          pb: { xs: focused ? 3 : 14, md: 6 },
        }}
      >
        {!desktop && !focused && <MobileHeader />}
        <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
      {!desktop && !focused && <BottomNav />}
      <Tour />
    </Box>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const tour = useRestartTour();
  const { data: me } = useMe();
  const { data: products = [] } = useProducts();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, value ? '0' : '1');
      } catch {
        // Not remembered: fine.
      }
      return !value;
    });
  };

  const stocked = areaStats(products).percent;

  return (
    <Box
      component="aside"
      sx={{
        width: collapsed ? 88 : 288,
        flexShrink: 0,
        boxSizing: 'border-box',
        position: 'sticky',
        top: 0,
        height: '100dvh',
        p: collapsed ? 1.5 : 2,
        pt: 3,
        bgcolor: palette.surface,
        borderRadius: '0 28px 28px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
        transition: 'width .25s ease',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: collapsed ? 'column' : 'row',
          justifyContent: 'space-between',
          gap: 1.75,
          pl: collapsed ? 0 : 1.25,
        }}
      >
        <Logo size={collapsed ? 34 : 36} short={collapsed} />
        <Tooltip title={t(collapsed ? 'nav.expand' : 'nav.collapse')} placement="right">
          <IconButton
            onClick={toggle}
            aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
            aria-expanded={!collapsed}
            sx={{ bgcolor: palette.canvas, color: palette.navy, width: 40, height: 40 }}
          >
            <Icon name="panel" size={18} />
          </IconButton>
        </Tooltip>
      </Box>

      {!collapsed && me && (
        <Box
          sx={{
            p: 2,
            borderRadius: '22px',
            bgcolor: palette.surface,
            backgroundImage: glow,
            border: `1px solid ${palette.track}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.75,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Box sx={{ fontSize: 12, color: palette.textMuted }}>{t('nav.household')}</Box>
              <Box sx={{ fontSize: 16, fontWeight: 500 }}>{me.household.name}</Box>
            </Box>
            <Avatars names={me.household.members.map((member) => member.name)} />
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            <MiniStat label={t('nav.stocked')} value={`${stocked}`} suffix="%" />
            <MiniStat label={t('nav.invite')} value={me.household.invite_code} />
          </Box>
        </Box>
      )}

      {collapsed ? (
        <IconButton
          aria-label={t('nav.search')}
          sx={{
            alignSelf: 'center',
            bgcolor: palette.canvas,
            width: 48,
            height: 48,
            color: palette.textMuted,
          }}
        >
          <Icon name="search" size={18} />
        </IconButton>
      ) : (
        <Box
          sx={{
            height: 44,
            borderRadius: 999,
            bgcolor: palette.canvas,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            px: 1.75,
            color: palette.textMuted,
          }}
        >
          <Icon name="search" size={18} />
          <InputBase
            placeholder={t('nav.search')}
            inputProps={{ 'aria-label': t('nav.search') }}
            sx={{ flex: 1, fontSize: 14 }}
          />
        </Box>
      )}

      <Box
        component="nav"
        aria-label="Main"
        sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}
      >
        {NAV.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </Box>

      <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {tour && (
          <NavButton
            icon="tour"
            label={t('tour.take')}
            collapsed={collapsed}
            onClick={tour.restart}
          />
        )}
        <NavButton icon="logout" label={t('nav.logout')} collapsed={collapsed} onClick={logout} />
      </Box>
    </Box>
  );
}

function NavItem({
  to,
  label,
  icon,
  collapsed,
}: {
  to: string;
  label: string;
  icon: IconName;
  collapsed: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ButtonBase
      component={NavLink}
      to={to}
      end={to === '/'}
      data-tour={`nav-${to}`}
      aria-label={t(label)}
      sx={{
        height: 44,
        width: collapsed ? 48 : 'auto',
        alignSelf: collapsed ? 'center' : 'stretch',
        justifyContent: collapsed ? 'center' : 'flex-start',
        px: collapsed ? 0 : 1.75,
        gap: 1.5,
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 500,
        color: palette.textSoft,
        '&.active': { bgcolor: palette.navy, color: '#FFFFFF' },
        '&:not(.active):hover': { bgcolor: palette.canvas },
      }}
    >
      <Icon name={icon} size={20} />
      {!collapsed && t(label)}
    </ButtonBase>
  );
}

function NavButton({
  icon,
  label,
  collapsed,
  onClick,
}: {
  icon: IconName;
  label: string;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={label}
      sx={{
        height: 44,
        width: collapsed ? 48 : 'auto',
        alignSelf: collapsed ? 'center' : 'stretch',
        justifyContent: collapsed ? 'center' : 'flex-start',
        px: collapsed ? 0 : 1.75,
        gap: 1.5,
        borderRadius: 999,
        fontSize: 14,
        color: palette.textMuted,
        '&:hover': { bgcolor: palette.canvas },
      }}
    >
      <Icon name={icon} size={20} />
      {!collapsed && label}
    </ButtonBase>
  );
}

function MiniStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <Box sx={{ p: 1.25, borderRadius: '14px', bgcolor: 'rgba(255,255,255,0.8)', minWidth: 0 }}>
      <Box sx={{ fontSize: 11, color: palette.textMuted }}>{label}</Box>
      <Box
        sx={{
          fontSize: 18,
          letterSpacing: '-0.02em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
        {suffix && (
          <Box component="span" sx={{ fontSize: 12, color: palette.textFaint }}>
            {suffix}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Avatars({ names }: { names: string[] }) {
  return (
    <Box sx={{ display: 'flex' }} aria-label={names.join(', ')}>
      {names.slice(0, 3).map((name, index) => (
        <Box
          key={name + index}
          sx={{
            width: 30,
            height: 30,
            ml: index ? -1 : 0,
            borderRadius: '50%',
            border: '2px solid #FFFFFF',
            bgcolor: index ? palette.frost : palette.navy,
            color: index ? palette.navy : '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {name[0]}
        </Box>
      ))}
    </Box>
  );
}

function MobileHeader() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const tour = useRestartTour();
  return (
    <Box
      component="header"
      sx={{
        pt: 3,
        pb: 1,
        px: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Logo size={32} />
      <Box sx={{ flex: 1 }} />
      {tour && (
        <IconButton
          onClick={tour.restart}
          disabled={tour.busy}
          aria-label={t('tour.take')}
          sx={{ bgcolor: palette.surface, color: palette.navy, width: 44, height: 44, mr: 1 }}
        >
          <Icon name="tour" size={20} />
        </IconButton>
      )}
      <IconButton
        onClick={logout}
        aria-label={t('nav.logout')}
        sx={{ bgcolor: palette.surface, color: palette.navy, width: 44, height: 44 }}
      >
        <Icon name="logout" size={20} />
      </IconButton>
    </Box>
  );
}

function BottomNav() {
  const { t } = useTranslation();
  return (
    <Box
      component="nav"
      aria-label="Main"
      sx={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(16px + env(safe-area-inset-bottom))',
        height: 64,
        borderRadius: 999,
        bgcolor: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        alignItems: 'center',
        px: 1,
        boxShadow: '0 8px 24px rgba(11,37,69,0.08)',
        zIndex: 10,
      }}
    >
      {NAV.filter((item) => item.to !== '/markets').map((item) => (
        <ButtonBase
          key={item.to}
          component={NavLink}
          to={item.to}
          end={item.to === '/'}
          data-tour={`nav-${item.to}`}
          aria-label={t(item.label)}
          sx={{
            justifySelf: 'center',
            width: 52,
            height: 44,
            borderRadius: 999,
            color: palette.textFaint,
            '&.active': { bgcolor: palette.navy, color: '#FFFFFF' },
          }}
        >
          <Icon name={item.icon} />
        </ButtonBase>
      ))}
    </Box>
  );
}
