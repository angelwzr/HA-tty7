import type { HomeAssistant } from './contracts';

// Follow HA frontend 20260930.2 formatDateTimeNumeric, useAmPm and resolveTimeZone.
// HA does not expose these as a custom-card API; keep the profile semantics here.
const resolvedLocalZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
// Android Intl polyfills may report an offset, which HA does not accept as an IANA zone.
const localZone = resolvedLocalZone && (resolvedLocalZone === 'UTC' || resolvedLocalZone === 'Etc/UTC' || resolvedLocalZone.includes('/'))
  ? resolvedLocalZone : undefined;
let cached: { key: string; date: Intl.DateTimeFormat; time: Intl.DateTimeFormat } | undefined;

export function formatTimestamp(value: string, hass: HomeAssistant | undefined): string {
  const language = hass?.locale?.language;
  const datePreference = hass?.locale?.date_format ?? 'system';
  const timePreference = hass?.locale?.time_format ?? 'system';
  const serverZone = hass?.config?.time_zone ?? localZone ?? 'UTC';
  // As in HA, server is used unless the profile explicitly selects a resolvable local zone.
  const timeZone = hass?.locale?.time_zone === 'local' && localZone ? localZone : serverZone;
  const key = `${language}|${datePreference}|${timePreference}|${timeZone}`;
  if (cached?.key !== key) {
    const hour12 = timePreference === '12' || (timePreference !== '24'
      && new Intl.DateTimeFormat(timePreference === 'language' ? language : undefined, { hour: 'numeric' }).resolvedOptions().hour12 === true);
    cached = {
      key,
      date: new Intl.DateTimeFormat(datePreference === 'system' ? undefined : language, {
        year: 'numeric', month: 'numeric', day: 'numeric', timeZone,
      }),
      time: new Intl.DateTimeFormat(language, {
        hour: 'numeric', minute: '2-digit', hourCycle: hour12 ? 'h12' : 'h23', timeZone,
      }),
    };
  }
  const date = new Date(value);
  let formattedDate: string;
  if (datePreference === 'language' || datePreference === 'system') {
    formattedDate = cached.date.format(date);
  } else {
    const parts = cached.date.formatToParts(date);
    const day = parts.find(item => item.type === 'day')!.value;
    const month = parts.find(item => item.type === 'month')!.value;
    const year = parts.find(item => item.type === 'year')!.value;
    const separator = parts.find(item => item.type === 'literal')?.value ?? '';
    const last = parts.at(-1);
    // Preserve locale punctuation, matching HA's numeric date ordering rules.
    const suffix = last?.type === 'literal' && !(language === 'bg' && datePreference === 'YMD') ? last.value : '';
    const order = datePreference === 'DMY' ? [day, month, year]
      : datePreference === 'MDY' ? [month, day, year] : [year, month, day];
    formattedDate = order.join(separator) + suffix;
  }
  return `${formattedDate}, ${cached.time.format(date)}`;
}
