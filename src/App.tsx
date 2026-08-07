import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { generateIcs } from '../ics-generator';
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
const DAY_NAMES: Record<WeekDay, string> = {
  Lun: 'Lunes',
  Mar: 'Martes',
  Mié: 'Miércoles',
  Jue: 'Jueves',
  Vie: 'Viernes',
  Sáb: 'Sábado',
  Dom: 'Domingo',
};
const CALENDAR_ACCENTS = ['#005f73', '#ca6702', '#3a5a40', '#7f5539', '#6d597a', '#0a9396', '#bb3e03'];
const ACADEMIC_SECTIONS: AcademicSection[] = [
  {
    key: 'periodo-1',
    label: 'Periodo 1',
    subtitle: '10 ago - 10 sep',
    startDate: new Date(2026, 7, 10),
    endDate: new Date(2026, 8, 10),
    tone: '#005f73',
  },
  {
    key: 'semana-tec-1',
    label: 'Semana Tec 1',
    subtitle: '14 sep - 18 sep',
    startDate: new Date(2026, 8, 14),
    endDate: new Date(2026, 8, 18),
    tone: '#ca6702',
  },
  {
    key: 'periodo-2',
    label: 'Periodo 2',
    subtitle: '21 sep - 22 oct',
    startDate: new Date(2026, 8, 21),
    endDate: new Date(2026, 9, 22),
    tone: '#3a5a40',
  },
  {
    key: 'semana-tec-2',
    label: 'Semana Tec 2',
    subtitle: '26 oct - 30 oct',
    startDate: new Date(2026, 9, 26),
    endDate: new Date(2026, 9, 30),
    tone: '#7f5539',
  },
  {
    key: 'periodo-3',
    label: 'Periodo 3',
    subtitle: '02 nov - 03 dic',
    startDate: new Date(2026, 10, 2),
    endDate: new Date(2026, 11, 3),
    tone: '#6d597a',
  },
];

function updateMateria(materias: Materia[], index: number, key: 'materia' | 'ubicacion', value: string): Materia[] {
  return materias.map((materia, currentIndex) => {
    if (currentIndex !== index) {
      return materia;
    }

    return {
      ...materia,
      [key]: value,
    };
  });
}

function formatRange(materia: Materia): string {
  return `${materia.fecha_inicio} - ${materia.fecha_fin}`;
}

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

  const totalClasses = useMemo(() => materias.reduce((count, materia) => count + materia.horarios.length, 0), [materias]);

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
      }),
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

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">CalendaTEC</p>
          <h1>Convierte el horario de IRIS en un calendario importable, sin subir el PDF.</h1>
          <p className="lede">
            Sube tu comprobante de <strong>Mi horario</strong>, corrige si hace falta, y descarga un .ics listo para Google Calendar,
            Outlook o Apple Calendar.
          </p>

          <div className="upload-card">
            <label className="upload-button">
              <input accept="application/pdf" aria-label="Subir PDF de horario" type="file" onChange={handleFileSelected} />
              <span>{state === 'loading' ? 'Analizando PDF…' : 'Elegir PDF de IRIS'}</span>
            </label>
            <p className="privacy-note">El archivo se procesa únicamente en tu navegador. Nada se sube a un servidor.</p>
            {fileName ? <p className="file-chip">{fileName}</p> : null}
            {error ? <p className="error-box">{error}</p> : null}
          </div>

          <div className="stats-row">
            <div>
              <span>Materias detectadas</span>
              <strong>{materias.length}</strong>
            </div>
            <div>
              <span>Bloques de horario</span>
              <strong>{totalClasses}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{state === 'downloaded' ? 'Descargado' : state}</strong>
            </div>
          </div>
        </div>

        <div className="hero-aside">
          <div className="manifesto-card">
            <p>Privacidad local</p>
            <h2>Parser en navegador, ICS en navegador, sin backend.</h2>
            <ul>
              <li>pdf.js lee el PDF desde el dispositivo del estudiante.</li>
              <li>La vista previa permite corregir materia y salón antes de exportar.</li>
              <li>El `.ics` usa `VTIMEZONE` para America/Mexico_City.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="panel calendar-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Vista previa editable</p>
            <h2>Horario dividido por periodo</h2>
          </div>
          <button className="download-button" disabled={state !== 'ready'} onClick={handleDownload} type="button">
            Descargar .ics
          </button>
        </div>

        {materias.length === 0 ? (
          <div className="empty-state">
            <p>Aún no hay materias cargadas. Sube un PDF de IRIS para ver aquí la semana completa del horario.</p>
          </div>
        ) : (
          <div className="calendar-stack">
            <div className="term-rail">
              {sectionedCalendar.map((section) => (
                <div key={section.key} className="term-pill" style={{ '--card-accent': section.tone } as CSSProperties}>
                  <strong>{section.label}</strong>
                  <span>{section.subtitle}</span>
                </div>
              ))}
            </div>

            <div className="term-sections">
              {sectionedCalendar.map((section) => (
                <section key={section.key} className="term-section" style={{ '--card-accent': section.tone } as CSSProperties}>
                  <header className="term-section-header">
                    <div>
                      <p>{section.label}</p>
                      <span>
                        {section.subtitle} · {section.materias.length} materias · {section.blocksInSection} bloques
                      </span>
                    </div>
                    <span className="term-section-badge">{section.key.includes('semana') ? 'Semana Tec' : 'Periodo'}</span>
                  </header>

                  <div className="mini-week-board">
                    {section.dayColumns.map(({ day, entries }) => (
                      <article key={`${section.key}-${day}`} className="mini-day-column">
                        <header className="mini-day-header">
                          <p>{DAY_NAMES[day]}</p>
                          <span>{entries.length}</span>
                        </header>
                        <div className="mini-day-body">
                          {entries.length === 0 ? (
                            <div className="mini-day-empty">Libre</div>
                          ) : (
                            entries.map((entry) => (
                              <article
                                key={`${section.key}-${day}-${entry.materia.code}-${entry.scheduleIndex}`}
                                className="mini-calendar-event"
                                style={{ '--card-accent': accentForIndex(entry.materiaIndex) } as CSSProperties}
                              >
                                <div className="mini-event-topline">
                                  <span>{entry.schedule.start}</span>
                                  <span>{entry.schedule.end}</span>
                                </div>
                                <strong>{entry.materia.code}</strong>
                                <p>{entry.materia.materia}</p>
                              </article>
                            ))
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  {section.materias.length === 0 ? (
                    <div className="section-empty">Sin materias en este bloque</div>
                  ) : (
                    <div className="term-editors">
                      {section.materias.map((materia) => {
                        const materiaIndex = materias.findIndex((item) => item.code === materia.code && item.materia === materia.materia);

                        return (
                          <article
                            key={`${section.key}-${materia.code}-${materiaIndex}`}
                            className="course-card"
                            style={{ '--card-accent': accentForIndex(Math.max(materiaIndex, 0)) } as CSSProperties}
                          >
                            <header className="course-card-header">
                              <div>
                                <span className="course-code">{materia.code}</span>
                                <h3>
                                  <input
                                    aria-label={`Editar materia ${materia.code}`}
                                    className="course-title-input"
                                    value={materia.materia}
                                    onChange={(event) => setMaterias(updateMateria(materias, materiaIndex, 'materia', event.target.value))}
                                  />
                                </h3>
                              </div>
                              <span className="range-chip">{formatRange(materia)}</span>
                            </header>

                            <p className="course-teachers">{materia.profesores}</p>

                            <div className="course-schedules">
                              {materia.horarios.map((schedule, scheduleIndex) => (
                                <span key={`${schedule.days}-${scheduleIndex}`} className="schedule-chip">
                                  {schedule.days} · {schedule.start} - {schedule.end}
                                </span>
                              ))}
                            </div>

                            <label className="field-label">
                              Ubicación
                              <input
                                aria-label={`Editar ubicación ${materia.code}`}
                                className="course-input"
                                value={materia.ubicacion ?? ''}
                                onChange={(event) => setMaterias(updateMateria(materias, materiaIndex, 'ubicacion', event.target.value))}
                              />
                            </label>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </section>

      {hasDownloaded ? (
        <section className="panel instructions-panel">
          <div>
            <p className="eyebrow">Siguiente paso</p>
            <h2>Importa el calendario en tu app favorita</h2>
          </div>
          <div className="instructions-grid">
            <article>
              <h3>Móvil</h3>
              <p>Abre el archivo descargado y confirma “Agregar a calendario”. En iPhone, comparte el .ics hacia Calendario.</p>
            </article>
            <article>
              <h3>Escritorio</h3>
              <p>Arrastra el archivo a Google Calendar o usa Importar en Outlook / Apple Calendar.</p>
            </article>
          </div>
        </section>
      ) : null}
    </main>
  );
}
