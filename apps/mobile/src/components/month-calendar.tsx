import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon, Tap, Txt } from './ui';

/** Month grid (Monday first) with the number of events per day; tap a day to see everything on it. */
export function MonthCalendar({ month, counts, selected, today, onSelect, onMonth }: {
  month: string; counts: Record<string, number>; selected: string | null; today: string; onSelect: (d: string) => void; onMonth: (delta: -1 | 1) => void;
}) {
  const th = useTheme();
  const { i18n, t } = useTranslation();
  const [y, m] = month.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  while (cells.length % 7) cells.push(null);
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.language, { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i))));
  const title = new Intl.DateTimeFormat(i18n.language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const canBack = month > today.slice(0, 7);
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: th.radius.lg, backgroundColor: th.c.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Tap onPress={() => canBack && onMonth(-1)} disabled={!canBack} accessibilityLabel={t('events.prevMonth')} hitSlop={10}><Icon name="chevron-left" size={26} color={canBack ? th.c.text : th.c.border} /></Tap>
        <Txt v="headline" style={{ textTransform: 'capitalize' }}>{title}</Txt>
        <Tap onPress={() => onMonth(1)} accessibilityLabel={t('events.nextMonth')} hitSlop={10}><Icon name="chevron-right" size={26} /></Tap>
      </View>
      <View style={{ flexDirection: 'row' }}>{weekdays.map((w, i) => <Txt key={i} v="caption" tone="tertiary" style={{ flex: 1, textAlign: 'center' }}>{w}</Txt>)}</View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={{ flexDirection: 'row' }}>
          {cells.slice(r * 7, r * 7 + 7).map((d, i) => {
            const n = d ? counts[d] ?? 0 : 0;
            const past = !!d && d < today;
            const sel = d === selected;
            return (
              <Tap key={i} disabled={!d || past} onPress={() => d && onSelect(d)} accessibilityRole="button" accessibilityLabel={d ? `${d}: ${t('events.countOnDay', { count: n })}` : undefined}
                style={{ flex: 1, aspectRatio: 1, margin: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? th.c.primary : d === today ? th.c.primarySoft : 'transparent' }}>
                {d ? (
                  <>
                    <Txt v="callout" style={{ color: sel ? th.c.onPrimary : past ? th.c.textTertiary : th.c.text }}>{Number(d.slice(8))}</Txt>
                    {n > 0 && !past ? <Txt v="micro" style={{ color: sel ? th.c.onPrimary : th.c.primaryText }}>{n}</Txt> : null}
                  </>
                ) : null}
              </Tap>
            );
          })}
        </View>
      ))}
    </View>
  );
}
