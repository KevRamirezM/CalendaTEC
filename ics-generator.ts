/**
 * ics-generator.ts
 *
 * Convierte materias IRIS a .ics. Los cursos largos se parten en segmentos
 * de Periodo, excluyendo Semanas TEC detectadas en el mismo horario, para
 * que no choquen en el calendario con las materias intensivas.
 */

export interface HorarioBloque {
  days: string; // ej. "Lun, Jue"
  start: string; // "07:00"
  end: string; // "09:00"
}

export interface Materia {
  code: string;
  materia: string;
  profesores: string;
  horarios: HorarioBloque[];
  fecha_inicio: string; // "DD.MM.YYYY"
  fecha_fin: string; // "DD.MM.YYYY"
  ubicacion: string | null;
}

type DateRange = {
  start: Date;
  end: Date;
};

const DAY_MAP: Record<string, string> = {
  Lun: "MO",
  Mar: "TU",
  Mié: "WE",
  Jue: "TH",
  Vie: "FR",
  Sáb: "SA",
  Dom: "SU",
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

/** Rangos de ≤7 días en el PDF = Semana TEC (u otra semana intensiva). */
const SEMANA_TEC_MAX_DAYS = 7;

function parseDMY(s: string): Date {
  const [day, month, year] = s.split(".").map(Number);
  return new Date(year, month - 1, day);
}

function formatDMY(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function durationDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

/** Primera fecha >= startDate que cae en alguno de los días de bydayList. */
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
  return n.toString().padStart(2, "0");
}

/** Formatea una fecha local como YYYYMMDDTHHMMSS (sin zona, para usarse con TZID). */
function fmtLocal(d: Date, hour: number, minute: number): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(hour)}${pad(minute)}00`;
}

/** Formatea una fecha como UTC YYYYMMDDTHHMMSSZ (requerido por UNTIL). */
function fmtUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/** Plegado de línea a 75 octetos, requerido por RFC 5545. */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  while (new TextEncoder().encode(rest).length > 75) {
    out.push(rest.slice(0, 75));
    rest = " " + rest.slice(75);
  }
  out.push(rest);
  return out.join("\r\n");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function detectSemanaTecRanges(materias: Materia[]): DateRange[] {
  const seen = new Set<string>();
  const ranges: DateRange[] = [];

  for (const m of materias) {
    if (!m.fecha_inicio || !m.fecha_fin) continue;
    const start = startOfDay(parseDMY(m.fecha_inicio));
    const end = startOfDay(parseDMY(m.fecha_fin));
    if (durationDays(start, end) > SEMANA_TEC_MAX_DAYS) continue;

    const key = `${formatDMY(start)}|${formatDMY(end)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranges.push({ start, end });
  }

  return ranges.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Quita huecos (Semanas TEC) de un rango de clases regulares. */
function subtractRanges(base: DateRange, holes: DateRange[]): DateRange[] {
  let segments: DateRange[] = [{ start: startOfDay(base.start), end: startOfDay(base.end) }];

  for (const hole of holes) {
    const holeStart = startOfDay(hole.start);
    const holeEnd = startOfDay(hole.end);
    const next: DateRange[] = [];

    for (const seg of segments) {
      if (holeEnd < seg.start || holeStart > seg.end) {
        next.push(seg);
        continue;
      }

      if (seg.start < holeStart) {
        const leftEnd = addDays(holeStart, -1);
        if (leftEnd >= seg.start) {
          next.push({ start: seg.start, end: leftEnd });
        }
      }

      if (seg.end > holeEnd) {
        const rightStart = addDays(holeEnd, 1);
        if (rightStart <= seg.end) {
          next.push({ start: rightStart, end: seg.end });
        }
      }
    }

    segments = next;
  }

  return segments.filter((seg) => seg.start <= seg.end);
}

function teachingSegmentsForMateria(m: Materia, semanaTecRanges: DateRange[]): DateRange[] {
  const start = startOfDay(parseDMY(m.fecha_inicio));
  const end = startOfDay(parseDMY(m.fecha_fin));
  const base = { start, end };

  // Semana TEC / intensivo: un solo bloque, sin restar.
  if (durationDays(start, end) <= SEMANA_TEC_MAX_DAYS) {
    return [base];
  }

  return subtractRanges(base, semanaTecRanges);
}

function segmentKind(seg: DateRange): "Semana TEC" | "Periodo" {
  return durationDays(seg.start, seg.end) <= SEMANA_TEC_MAX_DAYS ? "Semana TEC" : "Periodo";
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
  const location = (materia.ubicacion ?? "").replace(/\|/g, "-");
  const description = escapeText(
    `Profesor(es): ${materia.profesores}\nCódigo: ${materia.code}\n${kind}: ${rangeLabel}`,
  );

  return [
    "BEGIN:VEVENT",
    foldLine(`UID:${uid}@calendatec`),
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART;TZID=America/Mexico_City:${fmtLocal(dtstartDate, startH, startM)}`,
    `DTEND;TZID=America/Mexico_City:${fmtLocal(dtstartDate, endH, endM)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${byday.join(",")};UNTIL=${fmtUtc(until)}`,
    foldLine(`SUMMARY:${escapeText(materia.materia)}`),
    foldLine(`DESCRIPTION:${description}`),
    foldLine(`LOCATION:${escapeText(location)}`),
    foldLine(`CATEGORIES:${kind}`),
    "END:VEVENT",
  ].join("\r\n");
}

export function generateIcs(materias: Materia[], calendarName = "Horario TEC"): string {
  const events: string[] = [];
  const semanaTecRanges = detectSemanaTecRanges(materias);

  for (const m of materias) {
    if (!m.fecha_inicio || !m.fecha_fin) continue;

    const segments = teachingSegmentsForMateria(m, semanaTecRanges);

    for (const h of m.horarios) {
      const daysEs = h.days.split(",").map((d) => d.trim());
      const byday = daysEs.map((d) => DAY_MAP[d]).filter(Boolean);
      if (byday.length === 0) continue;

      const [startH, startM] = h.start.split(":").map(Number);
      const [endH, endM] = h.end.split(":").map(Number);

      segments.forEach((segment, segmentIndex) => {
        const uid = [
          m.code,
          h.days.replace(/\s+/g, ""),
          h.start.replace(":", ""),
          h.end.replace(":", ""),
          formatDMY(segment.start),
          formatDMY(segment.end),
          String(segmentIndex),
        ].join("-");

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

  // VTIMEZONE explícito: México no usa horario de verano desde 2022.
  const vtimezone = [
    "BEGIN:VTIMEZONE",
    "TZID:America/Mexico_City",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0600",
    "TZOFFSETTO:-0600",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ].join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CalendaTEC//Horario IRIS Export//ES",
    "CALSCALE:GREGORIAN",
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    vtimezone,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}
