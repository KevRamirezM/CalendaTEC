import { useEffect, useState, type ReactNode } from 'react';
import {
  AppleCalendarIcon,
  GoogleCalendarIcon,
  OutlookCalendarIcon,
  StepBrowserIcon,
  StepCheckIcon,
  StepFileIcon,
  StepImportIcon,
  StepMacIcon,
  StepPhoneIcon,
  StepSettingsIcon,
} from './icons';

type Platform = 'google' | 'apple' | 'outlook';

type GuideStep = {
  illustration: ReactNode;
  body: ReactNode;
};

const PLATFORMS: Array<{ id: Platform; label: string; icon: ReactNode }> = [
  { id: 'google', label: 'Google', icon: <GoogleCalendarIcon className="guide-platform-icon" /> },
  { id: 'apple', label: 'Apple', icon: <AppleCalendarIcon className="guide-platform-icon" /> },
  { id: 'outlook', label: 'Outlook', icon: <OutlookCalendarIcon className="guide-platform-icon" /> },
];

const STEPS: Record<Platform, GuideStep[]> = {
  google: [
    {
      illustration: <StepBrowserIcon className="guide-step-art" />,
      body: (
        <>
          Abre{' '}
          <a href="https://calendar.google.com" rel="noreferrer" target="_blank">
            calendar.google.com
          </a>{' '}
          en la computadora.
        </>
      ),
    },
    {
      illustration: <StepSettingsIcon className="guide-step-art" />,
      body: (
        <>
          Engranaje → <strong>Configuración</strong> → <strong>Importar y exportar</strong>.
        </>
      ),
    },
    {
      illustration: <StepFileIcon className="guide-step-art" />,
      body: (
        <>
          <strong>Seleccionar archivo del ordenador</strong> → elige <code>horario_tec.ics</code>.
        </>
      ),
    },
    {
      illustration: <StepImportIcon className="guide-step-art" />,
      body: (
        <>
          Elige el calendario destino → <strong>Importar</strong>.
        </>
      ),
    },
  ],
  apple: [
    {
      illustration: <StepPhoneIcon className="guide-step-art" />,
      body: (
        <>
          En iPhone/iPad: Archivos → toca <code>horario_tec.ics</code> → <strong>Añadir todo</strong>.
        </>
      ),
    },
    {
      illustration: <StepMacIcon className="guide-step-art" />,
      body: (
        <>
          En Mac: doble clic al <code>.ics</code> → Calendar lo abre → confirma la importación.
        </>
      ),
    },
    {
      illustration: <StepCheckIcon className="guide-step-art" />,
      body: <>Revisa que los eventos recurrentes cubran el semestre.</>,
    },
  ],
  outlook: [
    {
      illustration: <StepBrowserIcon className="guide-step-art" />,
      body: (
        <>
          Abre{' '}
          <a href="https://outlook.office.com/calendar" rel="noreferrer" target="_blank">
            outlook.office.com/calendar
          </a>{' '}
          (o Outlook.com).
        </>
      ),
    },
    {
      illustration: <StepSettingsIcon className="guide-step-art" />,
      body: (
        <>
          <strong>Agregar calendario</strong> → <strong>Cargar desde archivo</strong>.
        </>
      ),
    },
    {
      illustration: <StepImportIcon className="guide-step-art" />,
      body: (
        <>
          Selecciona <code>horario_tec.ics</code> → elige calendario → <strong>Importar</strong>.
        </>
      ),
    },
  ],
};

type IcsImportGuideProps = {
  hasDownloaded: boolean;
  canDownload: boolean;
  onDownload: () => void;
};

export function IcsImportGuide({ hasDownloaded, canDownload, onDownload }: IcsImportGuideProps) {
  const [platform, setPlatform] = useState<Platform>('google');

  useEffect(() => {
    if (hasDownloaded) {
      setPlatform('google');
    }
  }, [hasDownloaded]);

  const steps = STEPS[platform];

  return (
    <section aria-labelledby="guide-heading" className="guide">
      {hasDownloaded ? <p className="guide-ready">Listo — ahora impórtalo</p> : null}

      <header className="guide-head">
        <div className="guide-title-row">
          <h2 id="guide-heading">Cómo usar tu archivo .ics</h2>
          <button className="btn btn-accent guide-download" disabled={!canDownload} onClick={onDownload} type="button">
            Descargar .ics
          </button>
        </div>
      </header>

      <div aria-label="Calendario destino" className="guide-platforms" role="tablist">
        {PLATFORMS.map(({ id, label, icon }) => {
          const selected = platform === id;
          return (
            <button
              aria-controls={`guide-panel-${id}`}
              aria-selected={selected}
              className={selected ? 'guide-platform is-active' : 'guide-platform'}
              id={`guide-tab-${id}`}
              key={id}
              onClick={() => setPlatform(id)}
              role="tab"
              type="button"
            >
              {icon}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <ol aria-labelledby={`guide-tab-${platform}`} className="guide-steps" id={`guide-panel-${platform}`} role="tabpanel">
        {steps.map((step, index) => (
          <li className="guide-step" key={`${platform}-${index}`}>
            <div aria-hidden="true" className="guide-step-visual">
              {step.illustration}
              <span className="guide-step-num">{index + 1}</span>
            </div>
            <p className="guide-step-body">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
