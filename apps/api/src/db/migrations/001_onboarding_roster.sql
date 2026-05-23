-- Tenant onboarding pipeline: roster import + tenant-admin capability.
--
-- department / profile_category: org fields carried by each academic user,
-- populated from a university's faculty roster CSV (Categoría/Familia de
-- Perfil + Departamento/Unidad columns). faculty already exists on users.
--
-- tenant_admin: a capability flag SEPARATE from role. role controls data
-- scope (academic = personal scope, sees own papers); tenant_admin grants
-- administrative actions (roster import, user management) over the user's
-- OWN tenant only. Lets one person be an academic AND administer their
-- tenant without conflating the two (e.g. Héctor Quinteros: vicerrector +
-- researcher). Future secretaries get the same flag.

ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_category TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_admin BOOLEAN DEFAULT FALSE;
