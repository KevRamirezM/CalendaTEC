import type { Materia } from '../types';

export type DateRange = {
  start: Date;
  end: Date;
};

export type SegmentKind = 'Periodo' | 'Semana TEC';

/** Rangos de ≤7 días en el PDF = Semana TEC (u otra semana intensiva). */
export const SEMANA_TEC_MAX_DAYS = 7;

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function parseDMY(s: string): Date {
  const [day, month, year] = s.split('.').map(Number);
  return new Date(year, month - 1, day);
}

export function formatDMY(d: Date): string {
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export function durationDays(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function detectSemanaTecRanges(materias: Materia[]): DateRange[] {
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
export function subtractRanges(base: DateRange, holes: DateRange[]): DateRange[] {
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

export function teachingSegmentsForMateria(m: Materia, semanaTecRanges: DateRange[]): DateRange[] {
  const start = startOfDay(parseDMY(m.fecha_inicio));
  const end = startOfDay(parseDMY(m.fecha_fin));
  const base = { start, end };

  if (durationDays(start, end) <= SEMANA_TEC_MAX_DAYS) {
    return [base];
  }

  return subtractRanges(base, semanaTecRanges);
}

export function segmentKind(seg: DateRange): SegmentKind {
  return durationDays(seg.start, seg.end) <= SEMANA_TEC_MAX_DAYS ? 'Semana TEC' : 'Periodo';
}

export function segmentKey(seg: DateRange): string {
  return `${formatDMY(seg.start)}_${formatDMY(seg.end)}`;
}

/** Fechas legibles tomadas del horario (con año). */
export function formatDisplayRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const dayStart = String(start.getDate()).padStart(2, '0');
  const dayEnd = String(end.getDate()).padStart(2, '0');

  if (sameMonth) {
    return `${dayStart} – ${dayEnd} ${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()}`;
  }

  if (sameYear) {
    return `${dayStart} ${MONTH_SHORT[start.getMonth()]} – ${dayEnd} ${MONTH_SHORT[end.getMonth()]} ${start.getFullYear()}`;
  }

  return `${dayStart} ${MONTH_SHORT[start.getMonth()]} ${start.getFullYear()} – ${dayEnd} ${MONTH_SHORT[end.getMonth()]} ${end.getFullYear()}`;
}

export type ScheduleSectionMeta = {
  key: string;
  label: string;
  subtitle: string;
  kind: SegmentKind;
  start: Date;
  end: Date;
  materiaIndexes: number[];
};

function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && a.end >= b.start;
}

function isSemanaTecMateria(m: Materia): boolean {
  if (!m.fecha_inicio || !m.fecha_fin) return false;
  const start = startOfDay(parseDMY(m.fecha_inicio));
  const end = startOfDay(parseDMY(m.fecha_fin));
  return durationDays(start, end) <= SEMANA_TEC_MAX_DAYS;
}

/**
 * Vista previa: periodos canónicos = huecos entre Semanas TEC del horario.
 * Las Semanas TEC solo muestran materias intensivas (no cursos de semestre).
 * El .ics sigue usando teachingSegmentsForMateria por su cuenta.
 */
export function buildScheduleSections(materias: Materia[]): ScheduleSectionMeta[] {
  if (materias.length === 0) return [];

  const dated = materias
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => Boolean(m.fecha_inicio && m.fecha_fin));

  if (dated.length === 0) return [];

  const semanaTecRanges = detectSemanaTecRanges(materias);

  let semesterStart = startOfDay(parseDMY(dated[0].m.fecha_inicio));
  let semesterEnd = startOfDay(parseDMY(dated[0].m.fecha_fin));
  for (const { m } of dated) {
    const start = startOfDay(parseDMY(m.fecha_inicio));
    const end = startOfDay(parseDMY(m.fecha_fin));
    if (start < semesterStart) semesterStart = start;
    if (end > semesterEnd) semesterEnd = end;
  }

  const periodoRanges = subtractRanges({ start: semesterStart, end: semesterEnd }, semanaTecRanges);

  type RawSection = { kind: SegmentKind; seg: DateRange };
  const raw: RawSection[] = [
    ...periodoRanges.map((seg) => ({ kind: 'Periodo' as const, seg })),
    ...semanaTecRanges.map((seg) => ({ kind: 'Semana TEC' as const, seg })),
  ].sort((a, b) => a.seg.start.getTime() - b.seg.start.getTime());

  let periodoCount = 0;
  let semanaCount = 0;

  return raw
    .map(({ kind, seg }) => {
      const materiaIndexes = dated
        .filter(({ m }) => {
          const range = {
            start: startOfDay(parseDMY(m.fecha_inicio)),
            end: startOfDay(parseDMY(m.fecha_fin)),
          };

          if (kind === 'Semana TEC') {
            return isSemanaTecMateria(m) && rangesOverlap(range, seg);
          }

          // Periodo: solo materias regulares que cruzan este hueco (no intensivas).
          return !isSemanaTecMateria(m) && rangesOverlap(range, seg);
        })
        .map(({ index }) => index);

      if (materiaIndexes.length === 0) return null;

      const label = kind === 'Semana TEC' ? `Semana TEC ${++semanaCount}` : `Periodo ${++periodoCount}`;

      return {
        key: `${kind}-${segmentKey(seg)}`,
        label,
        subtitle: formatDisplayRange(seg.start, seg.end),
        kind,
        start: seg.start,
        end: seg.end,
        materiaIndexes,
      };
    })
    .filter((section): section is ScheduleSectionMeta => section !== null);
}
