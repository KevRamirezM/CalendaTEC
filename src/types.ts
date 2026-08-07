export interface HorarioBloque {
  days: string;
  start: string;
  end: string;
}

export interface Materia {
  code: string;
  materia: string;
  profesores: string;
  horarios: HorarioBloque[];
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string | null;
}
