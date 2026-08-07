import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { HorarioBloque, Materia } from '../types';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RIGHT_KEYWORDS = new Set([
  'Sub-período',
  'Sub-períodos',
  'Presencial',
  'Virtual',
  'Híbrido',
  'Inglés',
  'Español',
  'CRN',
  '|',
]);

const DATE_RANGE_RE = /^\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4}$/;
const DAY_TIME_RE = /^((?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom)(?:,\s*(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom))*)\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/;
const LOCATION_RE = /^[A-Z]{2,5}\s*\|.*\|/;
const UNIDAD_RE = /^Unidad de formación:\s*(\S+)$/;

const DAY_MAP: Record<string, string> = {
  Lun: 'MO',
  Mar: 'TU',
  Mié: 'WE',
  Jue: 'TH',
  Vie: 'FR',
  Sáb: 'SA',
  Dom: 'SU',
};

function hasRightKeyword(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase();
  return (
    normalized.includes('sub-período') ||
    normalized.includes('sub-períodos') ||
    normalized.includes('presencial') ||
    normalized.includes('virtual') ||
    normalized.includes('híbrido') ||
    normalized.includes('inglés') ||
    normalized.includes('español') ||
    normalized.includes('crn') ||
    normalized.includes('|')
  );
}

type TextLine = {
  top: number;
  text: string;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function groupTextItems(items: TextItem[], pageHeight: number): TextLine[] {
  const rows = new Map<number, TextItem[]>();

  for (const item of items) {
    const text = normalizeText(item.str);
    if (!text) {
      continue;
    }

    const top = Math.round(pageHeight - item.transform[5]);
    const bucket = rows.get(top) ?? [];
    bucket.push(item);
    rows.set(top, bucket);
  }

  const merged: Array<{ top: number; items: TextItem[] }> = [];
  const sortedTops = Array.from(rows.keys()).sort((a, b) => a - b);
  const used = new Set<number>();

  for (const top of sortedTops) {
    if (used.has(top)) {
      continue;
    }

    const group = [...(rows.get(top) ?? [])];
    for (const otherTop of sortedTops) {
      if (otherTop === top || used.has(otherTop)) {
        continue;
      }
      if (Math.abs(otherTop - top) <= 2) {
        group.push(...(rows.get(otherTop) ?? []));
        used.add(otherTop);
      }
    }

    used.add(top);
    merged.push({ top, items: group });
  }

  merged.sort((a, b) => a.top - b.top);

  return merged.map(({ top, items }) => {
    const ordered = [...items].sort((a, b) => a.transform[4] - b.transform[4]);
    const rightWords = ordered.filter((item) => item.transform[4] >= 250);
    const isRealRightCol = rightWords.some((item) => hasRightKeyword(item.str));

    const parts = isRealRightCol ? ordered.filter((item) => item.transform[4] < 250) : ordered;
    const lineText = parts.map((item) => normalizeText(item.str)).join(' ').trim();

    return {
      top,
      left: lineText,
      text: lineText,
    };
  });
}

async function readDocumentLines(file: File): Promise<TextLine[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const lines: TextLine[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const textItems = content.items.filter((item): item is TextItem => 'str' in item);
    lines.push(...groupTextItems(textItems, viewport.height));
  }

  return lines;
}

function parseDateRange(value: string): { fecha_inicio: string; fecha_fin: string } | null {
  const parts = value.split('-').map((part) => part.trim());
  if (parts.length !== 2) {
    return null;
  }

  return {
    fecha_inicio: parts[0],
    fecha_fin: parts[1],
  };
}

function parseScheduleLine(value: string): HorarioBloque | null {
  const match = DAY_TIME_RE.exec(value);
  if (!match) {
    return null;
  }

  return {
    days: match[1],
    start: match[2],
    end: match[3],
  };
}

function parseBlock(code: string, rawLines: string[]): Materia {
  const lines = [...rawLines];
  const materia = lines.shift() ?? '';
  const horarios: HorarioBloque[] = [];
  let fecha_inicio = '';
  let fecha_fin = '';
  let ubicacion: string | null = null;
  const profesorLines: string[] = [];

  for (const line of lines) {
    if (DATE_RANGE_RE.test(line)) {
      const parsed = parseDateRange(line);
      if (parsed) {
        fecha_inicio = parsed.fecha_inicio;
        fecha_fin = parsed.fecha_fin;
      }
      continue;
    }

    if (LOCATION_RE.test(line)) {
      ubicacion = line;
      continue;
    }

    const schedule = parseScheduleLine(line);
    if (schedule) {
      horarios.push(schedule);
      continue;
    }

    profesorLines.push(line);
  }

  return {
    code,
    materia,
    profesores: profesorLines.join(' ').trim(),
    horarios,
    fecha_inicio,
    fecha_fin,
    ubicacion,
  };
}

export async function parseIrisHorario(file: File): Promise<Materia[]> {
  const normalizedName = file.name.toLowerCase();
  if (file.type !== 'application/pdf' && !normalizedName.endsWith('.pdf')) {
    throw new Error('Sube un archivo PDF válido de IRIS.');
  }

  const lines = await readDocumentLines(file);
  const materiaLines = lines.map((line) => line.text).filter(Boolean);
  const hasIrisSignals = materiaLines.some((line) => /mi horario|bloques \/ materias|unidad de formación/i.test(line));

  if (!hasIrisSignals) {
    throw new Error('El PDF no parece ser un comprobante de horario de IRIS.');
  }

  const blocks: Array<{ code: string; rawLines: string[] }> = [];
  let current: { code: string; rawLines: string[] } | null = null;
  let locationSeen = false;

  for (const line of materiaLines) {
    if (!line) {
      continue;
    }

    const match = UNIDAD_RE.exec(line);
    if (match) {
      if (current) {
        blocks.push(current);
      }
      current = { code: match[1], rawLines: [] };
      locationSeen = false;
      continue;
    }

    if (!current) {
      continue;
    }

    if (locationSeen) {
      continue;
    }

    current.rawLines.push(line);
    if (LOCATION_RE.test(line)) {
      locationSeen = true;
    }
  }

  if (current) {
    blocks.push(current);
  }

  const materias = blocks.map(({ code, rawLines }) => parseBlock(code, rawLines)).filter((materia) => materia.materia.length > 0);

  if (materias.length === 0) {
    throw new Error('No se detectaron materias en el PDF.');
  }

  return materias;
}
