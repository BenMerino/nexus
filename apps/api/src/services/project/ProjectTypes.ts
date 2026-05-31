/* Project domain types. The project aggregate = a funded research project
 * (projects row) + its investigator roster (project_investigators, a child
 * replaced wholesale on update). Mirrors the existing db-projects shape. */

export interface ProjectInvestigatorInput {
  rol?: string;            // "IR" | "CO" (defaulted to CO)
  full_name?: string;
  orcid?: string;
}

export interface ProjectFields {
  titulo?: string;
  fuente_financiamiento?: string;
  concursable?: boolean;
  externo?: boolean;
  monto?: number | null;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  codigo?: string | null;
  departamento?: string | null;
  notas?: string | null;
}

export interface CreateProjectInput {
  fields: ProjectFields;
  investigators?: ProjectInvestigatorInput[];
}

export interface UpdateProjectInput {
  id: number;
  fields: ProjectFields;
  investigators?: ProjectInvestigatorInput[];
}
