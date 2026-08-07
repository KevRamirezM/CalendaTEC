import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { generateIcs } from '../ics-generator';
import { IcsImportGuide } from './components/IcsImportGuide';
import { parseIrisHorario } from './lib/iris-parser';
import type { Materia } from './types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'downloaded';
type WeekDay = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom';

type AcademicSectionKey = 'periodo-1' | 'semana-tec-1' | 'periodo-2' | 'semana-tec-2' | 'periodo-3';

type AcademicSection = {
  key: AcademicSectionKey;
  label: string;
  subtitle: string;
  startDate: Date;
  endDate: Date;
  tone: string;
};

type CalendarEntry = {
  day: WeekDay;
  materiaIndex: number;
  scheduleIndex: number;
  materia: Materia;
  schedule: Materia['horarios'][number];
  sectionKey: AcademicSectionKey;
};

type SectionCalendar = AcademicSection & {
  sectionIndex: number;
  materias: Materia[];
  blocksInSection: number;
  dayColumns: Array<{ day: WeekDay; entries: CalendarEntry[] }>;
};

const WEEK_DAYS: WeekDay[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAY_SHORT: Record<WeekDay, string> = {
  Lun: 'Lun',
  Mar: 'Mar',
  Mié: 'Mié',
  Jue: 'Jue',
  Vie: 'Vie',
  Sáb: 'Sáb',
  Dom: 'Dom',
};
const CALENDAR_ACCENTS = ['#1b4dff', '#c2410c', '#0f766e', '#a16207', '#9f1239', '#be123c', '#0369a1'];
const ACADEMIC_SECTIONS: AcademicSection[] = [
  {
    key: 'periodo-1',
    label: 'Periodo 1',
    subtitle: '10 ago – 10 sep',
    startDate: new Date(2026, 7, 10),
    endDate: new Date(2026, 8, 10),
    tone: '#1b4dff',
  },
  {
    key: 'semana-tec-1',
    label: 'Semana Tec 1',
    subtitle: '14 – 18 sep',
    startDate: new Date(2026, 8, 14),
    endDate: new Date(2026, 8, 18),
    tone: '#c2410c',
  },
  {
    key: 'periodo-2',
    label: 'Periodo 2',
    subtitle: '21 sep – 22 oct',
    startDate: new Date(2026, 8, 21),
    endDate: new Date(2026, 9, 22),
    tone: '#0f766e',
  },
  {
    key: 'semana-tec-2',
    label: 'Semana Tec 2',
    subtitle: '26 – 30 oct',
    startDate: new Date(2026, 9, 26),
    endDate: new Date(2026, 9, 30),
    tone: '#a16207',
  },
  {
    key: 'periodo-3',
    label: 'Periodo 3',
    subtitle: '02 nov – 03 dic',
    startDate: new Date(2026, 10, 2),
    endDate: new Date(2026, 11, 3),
    tone: '#9f1239',
  },
];

function splitDays(days: string): WeekDay[] {
  return days
    .split(',')
    .map((day) => day.trim())
    .filter((day): day is WeekDay => WEEK_DAYS.includes(day as WeekDay));
}

function accentForIndex(index: number): string {
  return CALENDAR_ACCENTS[index % CALENDAR_ACCENTS.length];
}

function parseDMYToDate(value: string): Date {
  const [day, month, year] = value.split('.').map(Number);
  return new Date(year, month - 1, day);
}

function isWithinSection(date: Date, section: AcademicSection): boolean {
  return date >= section.startDate && date <= section.endDate;
}

function classifySection(materia: Materia): AcademicSectionKey {
  const startDate = parseDMYToDate(materia.fecha_inicio);
  const exactMatch = ACADEMIC_SECTIONS.find((section) => isWithinSection(startDate, section));
  if (exactMatch) {
    return exactMatch.key;
  }

  const fallback = [...ACADEMIC_SECTIONS].reverse().find((section) => startDate >= section.endDate);
  return fallback?.key ?? ACADEMIC_SECTIONS[0].key;
}

export default function App() {
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [hasDownloaded, setHasDownloaded] = useState(false);

  useEffect(() => {
    document.title = 'CalendaTEC';
  }, []);

  const calendarEntries = useMemo<CalendarEntry[]>(() => {
    return materias.flatMap((materia, materiaIndex) => {
      const sectionKey = classifySection(materia);

      return materia.horarios.flatMap((schedule, scheduleIndex) =>
        splitDays(schedule.days).map((day) => ({
          day,
          materiaIndex,
          scheduleIndex,
          materia,
          schedule,
          sectionKey,
        })),
      );
    });
  }, [materias]);

  const sectionedCalendar = useMemo<SectionCalendar[]>(
    () =>
      ACADEMIC_SECTIONS.map((section, sectionIndex) => {
        const materiasInSection = materias.filter((materia) => classifySection(materia) === section.key);
        const blocksInSection = materiasInSection.reduce((count, materia) => count + materia.horarios.length, 0);
        const dayColumns = WEEK_DAYS.map((day) => ({
          day,
          entries: calendarEntries.filter((entry) => entry.sectionKey === section.key && entry.day === day),
        }));

        return {
          ...section,
          sectionIndex,
          materias: materiasInSection,
          blocksInSection,
          dayColumns,
        };
      }).filter((section) => section.materias.length > 0),
    [calendarEntries, materias],
  );

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setState('loading');
    setError('');
    setHasDownloaded(false);
    setFileName(file.name);

    try {
      const parsed = await parseIrisHorario(file);
      setMaterias(parsed);
      setState('ready');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo leer el PDF.';
      setError(message);
      setMaterias([]);
      setState('error');
    }
  }

  function handleDownload() {
    const ics = generateIcs(materias, 'Horario Tec');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'horario_tec.ics';
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setHasDownloaded(true);
    setState('downloaded');
  }

  const canDownload = state === 'ready' || state === 'downloaded';

  return (
    <main className="shell">
      <header className="hero">
        <p className="brand">CalendaTEC</p>
        <h1>IRIS → calendario</h1>
        <p className="lede">Sube tu PDF de Mi horario. Baja un .ics.</p>

        <div className="upload">
          <label className="btn btn-primary">
            <input accept="application/pdf" aria-label="Subir PDF de horario" type="file" onChange={handleFileSelected} />
            <span>{state === 'loading' ? 'Leyendo…' : 'Subir PDF'}</span>
          </label>
          <p className="meta">Solo en tu navegador</p>
        </div>

        {fileName ? <p className="file-name">{fileName}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </header>

      {materias.length > 0 ? (
        <>
          <IcsImportGuide canDownload={canDownload} hasDownloaded={hasDownloaded} onDownload={handleDownload} />

          <section className="preview" aria-label="Vista previa del horario">
            <div className="terms">
              {sectionedCalendar.map((section, index) => (
                <section
                  key={section.key}
                  className="term"
                  style={{ '--term-accent': section.tone, '--reveal-delay': `${index * 80}ms` } as CSSProperties}
                >
                  <header className="term-head">
                    <h3>{section.label}</h3>
                    <p>
                      {section.subtitle}
                      <span>{section.blocksInSection} bloques</span>
                    </p>
                  </header>

                  <div className="week">
                    {section.dayColumns.map(({ day, entries }) => (
                      <div key={`${section.key}-${day}`} className="day">
                        <div className="day-head">{DAY_SHORT[day]}</div>
                        <div className="day-body">
                          {entries.length === 0 ? (
                            <div className="day-empty" />
                          ) : (
                            entries.map((entry) => (
                              <article
                                key={`${section.key}-${day}-${entry.materia.code}-${entry.scheduleIndex}`}
                                className="block"
                                style={{ '--block-accent': accentForIndex(entry.materiaIndex) } as CSSProperties}
                              >
                                <time>
                                  {entry.schedule.start}–{entry.schedule.end}
                                </time>
                                <strong>{entry.materia.code}</strong>
                                <p>{entry.materia.materia}</p>
                              </article>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <div className="download-cta">
            <button className="btn btn-download" disabled={!canDownload} onClick={handleDownload} type="button">
              Descargar .ics
            </button>
            {hasDownloaded ? <p className="download-cta-done">Archivo listo — impórtalo con la guía de arriba</p> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
