/**
 * ics-generator.ts
 *
 * Convierte materias IRIS a .ics. Los cursos largos se parten en segmentos
 * de Periodo, excluyendo Semanas TEC detectadas en el mismo horario.
 */

import {
  detectSemanaTecRanges,
  formatDMY,
  segmentKind,
  teachingSegmentsForMateria,
  type DateRange,
} from './src/lib/schedule-segments';

export interface HorarioBloque {
  days: string;
  start: string;
  end: string;
}

export interface Materia {
  code: string;
  materia: string;
  profesores: string;
  horarios: HorarioBloque[];
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
}

const DAY_MAP: Record<string, string> = {
  Lun: 'MO',
  Mar: 'TU',
  Mié: 'WE',
  Jue: 'TH',
  Vie: 'FR',
  Sáb: 'SA',
  Dom: 'SU',
};

/** Índices de Date#getDay() (0=domingo … 6=sábado). */
const DAY_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function firstOccurrence(startDate: Date, bydayList: string[]): Date {
  const targetIndices = new Set(bydayList.map((d) => DAY_INDEX[d]));
  const d = new Date(startDate);
  for (let i = 0; i < 8; i++) {
    if (targetIndices.has(d.getDay())) return d;
    d.setDate(d.getDate() + 1);
  }
  return startDate;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function fmtLocal(d: Date, hour: number, minute: number): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hour)}${pad(minute)}00`;
}

function fmtUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    out.push(rest.slice(0, 75));
    rest = ' ' + rest.slice(75);
  }
  out.push(rest);
  return out.join('\r\n');
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function buildEvent(opts: {
  uid: string;
  materia: Materia;
  segment: DateRange;
  byday: string[];
  startH: number;
  startM: number;
  endH: number;
  endM: number;
}): string | null {
  const { uid, materia, segment, byday, startH, startM, endH, endM } = opts;
  const dtstartDate = firstOccurrence(segment.start, byday);
  if (dtstartDate > segment.end) {
    return null;
  }

  const until = new Date(segment.end);
  until.setHours(23, 59, 59);

  const kind = segmentKind(segment);
  const rangeLabel = `${formatDMY(segment.start)} - ${formatDMY(segment.end)}`;
  const location = (materia.ubicacion ?? '').replace(/\|/g, '-');
  const description = escapeText(
    `Profesor(es): ${materia.profesores}\nCódigo: ${materia.code}\n${kind}: ${rangeLabel}`,
  );

  return [
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}@calendatec`),
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART;TZID=America/Mexico_City:${fmtLocal(dtstartDate, startH, startM)}`,
    `DTEND;TZID=America/Mexico_City:${fmtLocal(dtstartDate, endH, endM)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday.join(',')};UNTIL=${fmtUtc(until)}`,
    foldLine(`SUMMARY:${escapeText(materia.materia)}`),
    foldLine(`DESCRIPTION:${description}`),
    foldLine(`LOCATION:${escapeText(location)}`),
    foldLine(`CATEGORIES:${kind}`),
    'END:VEVENT',
  ].join('\r\n');
}

export function generateIcs(materias: Materia[], calendarName = 'Horario TEC'): string {
  const events: string[] = [];
  const semanaTecRanges = detectSemanaTecRanges(materias);

  for (const m of materias) {
    if (!m.fecha_inicio || !m.fecha_fin) continue;

    const segments = teachingSegmentsForMateria(m, semanaTecRanges);

    for (const h of m.horarios) {
      const daysEs = h.days.split(',').map((d) => d.trim());
      const byday = daysEs.map((d) => DAY_MAP[d]).filter(Boolean);
      if (byday.length === 0) continue;

      const [startH, startM] = h.start.split(':').map(Number);
      const [endH, endM] = h.end.split(':').map(Number);

      segments.forEach((segment, segmentIndex) => {
        const uid = [
          m.code,
          h.days.replace(/\s+/g, ''),
          h.start.replace(':', ''),
          h.end.replace(':', ''),
          formatDMY(segment.start),
          formatDMY(segment.end),
          String(segmentIndex),
        ].join('-');

        const event = buildEvent({
          uid,
          materia: m,
          segment,
          byday,
          startH,
          startM,
          endH,
          endM,
        });

        if (event) {
          events.push(event);
        }
      });
    }
  }

  const vtimezone = [
    'BEGIN:VTIMEZONE',
    'TZID:America/Mexico_City',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:-0600',
    'TZOFFSETTO:-0600',
    'TZNAME:CST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ].join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CalendaTEC//Horario IRIS Export//ES',
    'CALSCALE:GREGORIAN',
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    vtimezone,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
