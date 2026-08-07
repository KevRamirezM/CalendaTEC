import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { generateIcs } from '../ics-generator';
import { IcsImportGuide } from './components/IcsImportGuide';
import { parseIrisHorario } from './lib/iris-parser';
import { buildScheduleSections } from './lib/schedule-segments';
import type { Materia } from './types';

type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'downloaded';
type WeekDay = 'Lun' | 'Mar' | 'Mié' | 'Jue' | 'Vie' | 'Sáb' | 'Dom';

type CalendarEntry = {
  day: WeekDay;
  materiaIndex: number;
  scheduleIndex: number;
  materia: Materia;
  schedule: Materia['horarios'][number];
};

type SectionCalendar = {
  key: string;
  label: string;
  subtitle: string;
  tone: string;
  materias: Materia[];
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

function splitDays(days: string): WeekDay[] {
  return days
    .split(',')
    .map((day) => day.trim())
    .filter((day): day is WeekDay => WEEK_DAYS.includes(day as WeekDay));
}

function accentForIndex(index: number): string {
  return CALENDAR_ACCENTS[index % CALENDAR_ACCENTS.length];
}

function buildSectionedCalendar(materias: Materia[]): SectionCalendar[] {
  const sections = buildScheduleSections(materias);

  return sections.map((section, sectionIndex) => {
    const sectionMaterias = section.materiaIndexes.map((index) => materias[index]);

    const dayColumns = WEEK_DAYS.map((day) => ({
      day,
      entries: section.materiaIndexes.flatMap((materiaIndex) => {
        const materia = materias[materiaIndex];
        return materia.horarios.flatMap((schedule, scheduleIndex) =>
          splitDays(schedule.days)
            .filter((scheduleDay) => scheduleDay === day)
            .map((scheduleDay) => ({
              day: scheduleDay,
              materiaIndex,
              scheduleIndex,
              materia,
              schedule,
            })),
        );
      }),
    }));

    return {
      key: section.key,
      label: section.label,
      subtitle: section.subtitle,
      tone: accentForIndex(sectionIndex),
      materias: sectionMaterias,
      dayColumns,
    };
  });
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

  const sectionedCalendar = useMemo(() => buildSectionedCalendar(materias), [materias]);

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
    const ics = generateIcs(materias, 'Horario TEC');
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
        <h1>
          IRIS <span aria-hidden="true" className="hero-arrow">
            →
          </span>{' '}
          Calendario
        </h1>
        <p className="lede">Sube tu PDF descargado de IRIS para comenzar.</p>

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
                      <span className="term-dates">{section.subtitle}</span>
                      <span className="term-count">{section.materias.length} materias</span>
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
                                key={`${section.key}-${day}-${entry.materia.code}-${entry.scheduleIndex}-${entry.schedule.start}-${entry.schedule.end}`}
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
