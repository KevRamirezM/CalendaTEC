"""
iris_to_ics.py

Convierte el PDF de "Mi horario" de iris.tec.mx a un archivo .ics
importable en Google Calendar, Outlook, Apple Calendar, etc.

Requisitos:
    pip install pdfplumber icalendar

Uso:
    python iris_to_ics.py HORARIO.pdf salida.ics
"""

import sys
import re
import json
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

import pdfplumber


# ---------------------------------------------------------------------------
# 1. PARSEO DEL PDF
# ---------------------------------------------------------------------------

X_THRESHOLD = 250  # separación aproximada entre columna izquierda/derecha
RIGHT_KEYWORDS = {
    "Sub-período", "Sub-períodos", "Presencial", "Virtual", "Híbrido",
    "Inglés", "Español", "CRN", "|",
}

DATE_RANGE_RE = re.compile(r"^\d{2}\.\d{2}\.\d{4}\s*-\s*\d{2}\.\d{2}\.\d{4}$")
DAY_TIME_RE = re.compile(
    r"^((?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom)(?:,\s*(?:Lun|Mar|Mié|Jue|Vie|Sáb|Dom))*)"
    r"\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$"
)
LOCATION_RE = re.compile(r"^[A-Z]{2,5}\s*\|.*\|")
UNIDAD_RE = re.compile(r"^Unidad de formación:\s*(\S+)$")

DAY_MAP = {"Lun": "MO", "Mar": "TU", "Mié": "WE", "Jue": "TH",
           "Vie": "FR", "Sáb": "SA", "Dom": "SU"}
DAY_INDEX = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}


def _get_lines(page):
    """
    Agrupa palabras por fila (mismo 'top') y separa columna izquierda
    (datos de la materia) de la derecha (metadata administrativa: CRN,
    sub-período, modalidad). La separación NO se hace solo por posición X,
    porque nombres de materia largos invaden esa zona -- se confirma que
    una fila es "columna derecha real" solo si contiene vocabulario
    reconocible (RIGHT_KEYWORDS).
    """
    words = page.extract_words()
    rows = defaultdict(list)
    for w in words:
        rows[round(w["top"])].append(w)

    # fusiona filas cuyo 'top' difiere por redondeo (<=2px)
    tops = sorted(rows.keys())
    merged, used = [], set()
    for t in tops:
        if t in used:
            continue
        group = list(rows[t])
        for t2 in tops:
            if t2 != t and abs(t2 - t) <= 2 and t2 not in used:
                group.extend(rows[t2])
                used.add(t2)
        used.add(t)
        merged.append((t, group))
    merged.sort(key=lambda x: x[0])

    result = []
    for t, group in merged:
        ordered = sorted(group, key=lambda w: w["x0"])
        right_words = [w for w in ordered if w["x0"] >= X_THRESHOLD]
        is_real_right_col = any(w["text"] in RIGHT_KEYWORDS for w in right_words)
        if is_real_right_col:
            left = " ".join(w["text"] for w in ordered if w["x0"] < X_THRESHOLD)
        else:
            left = " ".join(w["text"] for w in ordered)
        result.append((t, left.strip()))
    return result


def parse_iris_pdf(pdf_path):
    """Devuelve una lista de materias con sus bloques de horario."""
    all_lines = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            all_lines.extend(_get_lines(page))

    blocks = []
    current = None
    pending_category = None
    location_seen = False

    for _, left in all_lines:
        if not left:
            continue
        m = UNIDAD_RE.match(left)
        if m:
            if current:
                blocks.append(current)
            current = {"code": m.group(1), "raw_lines": [], "category": pending_category}
            pending_category = None
            location_seen = False
            continue
        if current is not None:
            if location_seen:
                # Todo lo que aparece después del salón y antes del siguiente
                # bloque es un encabezado de sección ("Materias LiFE",
                # "Tópico de exploración", etc.), no datos de la materia.
                pending_category = left
                continue
            current["raw_lines"].append(left)
            if LOCATION_RE.match(left):
                location_seen = True
    if current:
        blocks.append(current)

    parsed = []
    for b in blocks:
        lines = list(b["raw_lines"])
        materia = lines.pop(0)
        schedule_entries, date_range, location, professor_lines = [], None, None, []

        for line in lines:
            if DATE_RANGE_RE.match(line):
                date_range = line
            elif LOCATION_RE.match(line):
                location = line
            elif DAY_TIME_RE.match(line):
                dm = DAY_TIME_RE.match(line)
                schedule_entries.append(
                    {"days": dm.group(1), "start": dm.group(2), "end": dm.group(3)}
                )
            else:
                professor_lines.append(line)

        parsed.append({
            "code": b["code"],
            "materia": materia,
            "profesores": " ".join(professor_lines).strip(),
            "horarios": schedule_entries,
            "fecha_inicio": date_range.split("-")[0].strip() if date_range else None,
            "fecha_fin": date_range.split("-")[1].strip() if date_range else None,
            "ubicacion": location,
        })
    return parsed


# ---------------------------------------------------------------------------
# 2. GENERACIÓN DEL ICS
# ---------------------------------------------------------------------------

def _parse_date(s):
    return datetime.strptime(s, "%d.%m.%Y")


def _first_occurrence(start_date, byday_list):
    """Primera fecha >= start_date que cae en alguno de los días de byday_list."""
    target_indices = {DAY_INDEX[d] for d in byday_list}
    d = start_date
    for _ in range(8):
        if d.weekday() in target_indices:
            return d
        d += timedelta(days=1)
    return start_date


def _fold_line(line):
    """Plegado de línea a 75 octetos, requerido por RFC 5545."""
    out = []
    while len(line.encode("utf-8")) > 75:
        out.append(line[:75])
        line = " " + line[75:]
    out.append(line)
    return "\r\n".join(out)


def generate_ics(materias, calendar_name="Horario Tec"):
    events = []
    for m in materias:
        start_date = _parse_date(m["fecha_inicio"])
        end_date = _parse_date(m["fecha_fin"])
        location = (m.get("ubicacion") or "").replace("|", "-")

        for h in m["horarios"]:
            days_es = [d.strip() for d in h["days"].split(",")]
            byday = [DAY_MAP[d] for d in days_es]
            dtstart_date = _first_occurrence(start_date, byday)

            start_h, start_m = h["start"].split(":")
            end_h, end_m = h["end"].split(":")
            dtstart = dtstart_date.replace(hour=int(start_h), minute=int(start_m))
            dtend = dtstart_date.replace(hour=int(end_h), minute=int(end_m))
            until = end_date.replace(hour=23, minute=59, second=59)

            uid = str(uuid.uuid4())
            description = f"Profesor(es): {m['profesores']}\\nCódigo: {m['code']}"

            events.append("\r\n".join([
                "BEGIN:VEVENT",
                _fold_line(f"UID:{uid}@irisexport"),
                f'DTSTAMP:{datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")}',
                f'DTSTART;TZID=America/Mexico_City:{dtstart.strftime("%Y%m%dT%H%M%S")}',
                f'DTEND;TZID=America/Mexico_City:{dtend.strftime("%Y%m%dT%H%M%S")}',
                f'RRULE:FREQ=WEEKLY;BYDAY={",".join(byday)};UNTIL={until.strftime("%Y%m%dT%H%M%SZ")}',
                _fold_line(f"SUMMARY:{m['materia']}"),
                _fold_line(f"DESCRIPTION:{description}"),
                _fold_line(f"LOCATION:{location}"),
                "END:VEVENT",
            ]))

    # VTIMEZONE explícito: México no usa horario de verano desde 2022,
    # así que UTC-6 es fijo todo el año. Sin este bloque, varios clientes
    # de calendario ignoran silenciosamente la recurrencia de eventos
    # que usan TZID en vez de horas UTC puras.
    vtimezone = "\r\n".join([
        "BEGIN:VTIMEZONE",
        "TZID:America/Mexico_City",
        "BEGIN:STANDARD",
        "DTSTART:19700101T000000",
        "TZOFFSETFROM:-0600",
        "TZOFFSETTO:-0600",
        "TZNAME:CST",
        "END:STANDARD",
        "END:VTIMEZONE",
    ])

    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Redito//Horario IRIS Export//ES",
        "CALSCALE:GREGORIAN",
        _fold_line(f"X-WR-CALNAME:{calendar_name}"),
        vtimezone,
        *events,
        "END:VCALENDAR",
    ])


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python iris_to_ics.py HORARIO.pdf salida.ics")
        sys.exit(1)

    pdf_path, ics_path = sys.argv[1], sys.argv[2]
    materias = parse_iris_pdf(pdf_path)

    # opcional: guarda también el JSON intermedio, útil para debug o
    # para mostrar el preview editable en tu frontend antes de sincronizar
    with open(ics_path.replace(".ics", ".json"), "w", encoding="utf-8") as f:
        json.dump(materias, f, ensure_ascii=False, indent=2)

    ics_content = generate_ics(materias)
    with open(ics_path, "w", encoding="utf-8") as f:
        f.write(ics_content)

    print(f"{len(materias)} materias procesadas -> {ics_path}")
