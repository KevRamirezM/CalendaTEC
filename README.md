<p align="center">
  <img src="assets/calendatec-logo.png" alt="CalendaTEC" width="420" />
</p>

Convierte el PDF de **Mi horario** de [IRIS](https://iris.tec.mx) en un archivo `.ics` para Google Calendar, Outlook, Apple Calendar y más.

Todo corre en tu navegador: el PDF no se sube a ningún servidor.

## Cómo usarlo

1. En IRIS, descarga tu horario en PDF.
2. Abre CalendaTEC y sube ese PDF.
3. Revisa la vista previa.
4. Descarga el `.ics` e impórtalo en tu calendario.

## Desarrollo local

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite (por lo general `http://localhost:5173`).

```bash
npm run build    # build de producción
npm run preview  # previsualizar el build
```

## Alternativa por terminal (Python)

Si prefieres no usar la web:

```bash
pip install pdfplumber icalendar
python iris_to_ics.py HORARIO.pdf horario_tec.ics
```
