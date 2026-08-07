/**
 * ics-generator.ts
 *
 * Convierte el JSON de materias extraído del PDF de iris.tec.mx a un
 * archivo .ics importable en Google Calendar, Outlook, Apple Calendar, etc.
 *
 * Esto NO incluye el parseo del PDF (eso depende de qué librería de PDF
 * uses en Deno/Node — pdf-parse, unpdf, etc.). Este módulo asume que ya
 * tienes el horario en esta forma:
 *
 *   type HorarioBloque = { days: string; start: string; end: string };
 *   type Materia = {
 *     code: string;
 *     materia: string;
 *     profesores: string;
 *     horarios: HorarioBloque[];
 *     fecha_inicio: string; // "DD.MM.YYYY"
 *     fecha_fin: string;    // "DD.MM.YYYY"
 *     ubicacion: string | null;
 *   };
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

const DAY_MAP: Record<string, string> = {
  Lun: "MO",
  Mar: "TU",
  Mié: "WE",
  Jue: "TH",
  Vie: "FR",
  Sáb: "SA",
  Dom: "SU",
};

const DAY_INDEX: Record<string, number> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
};

function parseDMY(s: string): Date {
  const [day, month, year] = s.split(".").map(Number);
  return new Date(year, month - 1, day);
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

export function generateIcs(materias: Materia[], calendarName = "Horario Tec"): string {
  const events: string[] = [];

  for (const m of materias) {
    const startDate = parseDMY(m.fecha_inicio);
    const endDate = parseDMY(m.fecha_fin);
    const location = (m.ubicacion ?? "").replace(/\|/g, "-");

    for (const h of m.horarios) {
      const daysEs = h.days.split(",").map((d) => d.trim());
      const byday = daysEs.map((d) => DAY_MAP[d]);
      const dtstartDate = firstOccurrence(startDate, byday);

      const [startH, startM] = h.start.split(":").map(Number);
      const [endH, endM] = h.end.split(":").map(Number);

      const until = new Date(endDate);
      until.setHours(23, 59, 59);

      const uid = crypto.randomUUID();
      const description = escapeText(`Profesor(es): ${m.profesores}\nCódigo: ${m.code}`);

      events.push(
        [
          "BEGIN:VEVENT",
          foldLine(`UID:${uid}@irisexport`),
          `DTSTAMP:${fmtUtc(new Date())}`,
          `DTSTART;TZID=America/Mexico_City:${fmtLocal(dtstartDate, startH, startM)}`,
          `DTEND;TZID=America/Mexico_City:${fmtLocal(dtstartDate, endH, endM)}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${byday.join(",")};UNTIL=${fmtUtc(until)}`,
          foldLine(`SUMMARY:${escapeText(m.materia)}`),
          foldLine(`DESCRIPTION:${description}`),
          foldLine(`LOCATION:${escapeText(location)}`),
          "END:VEVENT",
        ].join("\r\n")
      );
    }
  }

  // VTIMEZONE explícito: México no usa horario de verano desde 2022, así
  // que UTC-6 es fijo todo el año. Sin este bloque, varios clientes de
  // calendario ignoran silenciosamente la recurrencia de eventos que usan
  // TZID en vez de horas UTC puras.
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
    "PRODID:-//Redito//Horario IRIS Export//ES",
    "CALSCALE:GREGORIAN",
    foldLine(`X-WR-CALNAME:${escapeText(calendarName)}`),
    vtimezone,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ------------------------------------------------------------------------
 * Ejemplo de uso dentro de una Supabase Edge Function:
 *
 *   import { generateIcs, type Materia } from "./ics-generator.ts";
 *
 *   Deno.serve(async (req) => {
 *     const { materias } = await req.json() as { materias: Materia[] };
 *     const ics = generateIcs(materias);
 *     return new Response(ics, {
 *       headers: {
 *         "Content-Type": "text/calendar; charset=utf-8",
 *         "Content-Disposition": 'attachment; filename="horario.ics"',
 *       },
 *     });
 *   });
 * ---------------------------------------------------------------------- */
