/* Type surface for the JS project repo (`db-projects.js`) so the
 * TypeScript ProjectGovernor can import it typed. Runtime is CommonJS;
 * this only describes the shape. The repo still uses the legacy `sql`
 * pool — it moves to `withTenant` in the RLS phase, not here. */

import type { ProjectFields, ProjectInvestigatorInput } from "../services/project/ProjectTypes";

export function listProjects(tenantId: number): Promise<any[]>;
export function getProject(id: number, tenantId: number): Promise<any | null>;
export function createProject(
  tenantId: number,
  fields: ProjectFields,
  investigators: ProjectInvestigatorInput[] | undefined,
  createdById: string | null,
): Promise<number>;
export function updateProject(
  id: number,
  tenantId: number,
  fields: ProjectFields,
  investigators: ProjectInvestigatorInput[] | undefined,
): Promise<boolean>;
export function deleteProject(id: number, tenantId: number): Promise<boolean>;
