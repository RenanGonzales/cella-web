import { Box, ButtonBase, Skeleton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

import { useSpending } from '../../api/hooks';
import type { MonthSpending } from '../../api/types';
import { formatMoney, splitMoney } from '../../lib/format';
import { monthName, summarizeSpending } from '../../lib/spending';
import { palette } from '../../theme';
import { BigNumber, Card, Icon, Money } from '../ui';

/**
 * What was paid this month, against last month, with one bar per month. On the home
 * screen it links to the history; on the history screen it is the header.
 */
export function SpendingCard({ months = 4, link = false }: { months?: number; link?: boolean }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { data, isLoading } = useSpending(months);

  if (isLoading || !data) {
    return <Skeleton variant="rounded" height={190} sx={{ borderRadius: '30px' }} />;
  }

  const summary = summarizeSpending(data);
  const current = summary.current;
  const body = (
    <Card highlight={!link} padding={2.75}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 500 }}>
        {current ? t('spending.spentIn', { month: monthName(current.month, locale) }) : ''}
        {link && <Icon name="arrow" size={20} />}
      </Box>
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 1.5 }}>
        <BigNumber
          value={<Money parts={splitMoney(current?.paid_cents ?? 0, locale)} />}
          size={link ? 44 : 56}
        />
        {summary.previous && summary.previous.paid_cents > 0 && (
          // The current month is still running: compare with last month's amount, not a %.
          <Box component="span" sx={{ fontSize: 14, color: palette.textMuted }}>
            {t('spending.vs', {
              amount: formatMoney(summary.previous.paid_cents, locale),
              month: monthName(summary.previous.month, locale),
            })}
          </Box>
        )}
      </Box>
      <Box sx={{ mt: 0.5, fontSize: 13, color: palette.textMuted }}>
        {t('spending.trips', { count: current?.purchases ?? 0 })}
      </Box>
      <MonthBars months={data} peak={summary.peak} locale={locale} />
    </Card>
  );

  if (!link) return body;
  return (
    <ButtonBase
      component={RouterLink}
      to="/history"
      data-tour="home-spending"
      sx={{ display: 'block', textAlign: 'left', borderRadius: '30px', color: 'inherit' }}
    >
      {body}
    </ButtonBase>
  );
}

function MonthBars({
  months,
  peak,
  locale,
}: {
  months: MonthSpending[];
  peak: number;
  locale: string;
}) {
  const { t } = useTranslation();
  const height = 56;
  const label = months
    .map((month) => `${monthName(month.month, locale)} ${formatMoney(month.paid_cents, locale)}`)
    .join(', ');
  return (
    <Box
      role="img"
      aria-label={t('spending.chart', { months: label })}
      sx={{ mt: 2, display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)`, gap: 1 }}
    >
      {months.map((month, index) => {
        const last = index === months.length - 1;
        const ratio = peak > 0 ? month.paid_cents / peak : 0;
        return (
          <Box key={month.month} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ height, display: 'flex', alignItems: 'flex-end' }}>
              <Box
                sx={{
                  width: '100%',
                  height: Math.max(4, Math.round(ratio * height)),
                  borderRadius: '8px',
                  bgcolor: last ? palette.navy : month.paid_cents ? palette.steel : palette.track,
                }}
              />
            </Box>
            <Box
              sx={{
                fontSize: 11,
                textAlign: 'center',
                color: last ? palette.navy : palette.textMuted,
                fontWeight: last ? 500 : 400,
              }}
            >
              {monthName(month.month, locale, 'short')}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
