// Project + investigator types for the Projects page. Mirrors the shape the
// /api/projects endpoint returns (list/get) and accepts (create/update body).

export interface Investigator {
  full_name: string;
  orcid: string | null;
  rol: 'IR' | 'CO';
  /** Present on read (list/get) when the investigator matched a tenant user. */
  user_id?: number | null;
}

export interface Project {
  id: number;
  titulo: string;
  fuente_financiamiento: string | null;
  codigo: string | null;
  monto: number | null;
  departamento: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  concursable: boolean;
  externo: boolean;
  notas: string | null;
  investigators: Investigator[];
}

/** The mutable form state (a draft project, no id). */
export type ProjectDraft = Omit<Project, 'id'>;

export function emptyDraft(): ProjectDraft {
  return {
    titulo: '', fuente_financiamiento: null, codigo: '', monto: null,
    departamento: null, fecha_inicio: null, fecha_fin: null,
    concursable: true, externo: true, notas: '',
    investigators: [{ rol: 'IR', full_name: '', orcid: '' }],
  };
}

export interface Me {
  role: string;
  tenantAdmin?: boolean;
}

const EDITOR_ROLES = ['secretary', 'director', 'admin', 'superadmin'];

export function isEditor(me: Me | null): boolean {
  return !!me && (EDITOR_ROLES.includes(me.role) || me.tenantAdmin === true);
}
