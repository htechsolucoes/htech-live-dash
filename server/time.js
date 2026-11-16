// Utilidades de data/hora com fuso configurável (padrão America/Sao_Paulo).

/** Offset (em minutos) do fuso `tz` no instante `date`. Ex.: São Paulo → -180 */
export function tzOffsetMinutes(tz, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = name.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Data local (YYYY-MM-DD) no fuso `tz`. */
export function localDateKey(tz, date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
}

/** Instante UTC correspondente à meia-noite de hoje no fuso `tz`. */
export function startOfTodayUtc(tz, now = new Date()) {
  const [y, mo, d] = localDateKey(tz, now).split('-').map(Number);
  const guess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const off = tzOffsetMinutes(tz, new Date(guess));
  return new Date(guess - off * 60_000);
}

/** Hora local (0–23) de um instante no fuso `tz`. */
export function localHour(tz, date) {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(date),
  );
}

/**
 * Converte as durações que a API devolve como texto (timeService / timeWait) em segundos.
 * Aceita "HH:MM:SS", "d.HH:MM:SS(.fff)" (TimeSpan .NET), ISO-8601 "PT1H2M3S" e números (segundos).
 * Retorna null se não reconhecer o formato.
 */
export function parseDuration(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const s = String(value).trim();

  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);

  let m = s.match(/^(?:(\d+)[.:])?(\d{1,2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (m) {
    const [, days, h, mi, se] = m;
    return Number(days ?? 0) * 86400 + Number(h) * 3600 + Number(mi) * 60 + Number(se);
  }

  m = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (m) {
    const [, d, h, mi, se] = m;
    return Number(d ?? 0) * 86400 + Number(h ?? 0) * 3600 + Number(mi ?? 0) * 60 + Number(se ?? 0);
  }

  return null;
}

export const secondsBetween = (a, b) => {
  if (!a || !b) return null;
  const v = (new Date(b).getTime() - new Date(a).getTime()) / 1000;
  return Number.isFinite(v) && v >= 0 ? v : null;
};