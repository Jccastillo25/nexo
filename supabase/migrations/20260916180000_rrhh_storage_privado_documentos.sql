-- =============================================================================
-- Fase 4 del bloque "pre-F1.5" (docs/status-log/2026-09-16-rrhh-pre-f1-5.md):
-- Storage privado de RRHH. Permisos rrhh.expedientes.documentos.ver/subir/
-- eliminar YA EXISTEN desde 2026-09-02 (huerfanos hasta ahora, sin bucket
-- ni tabla detras); .descargar se agrego en el Paso Cero de Fase 5
-- (20260916160000). Sin permiso nuevo en esta migracion.
--
-- Bucket PRIVADO (public=false) -- a diferencia de `platform-assets`
-- (branding, publico a proposito). CERO politicas de storage.objects para
-- `anon` ni `authenticated`: todo el acceso pasa por Server Actions con
-- service_role que llaman requirePermission() primero (mismo patron ya
-- usado para el flujo de subida de marca), y las URLs firmadas
-- (createSignedUploadUrl/createSignedUrl) se generan ahi -- nunca se
-- persiste una URL firmada como fuente de verdad, solo `storage_path`.
--
-- Subida por URL firmada de SUBIDA DIRECTA (createSignedUploadUrl), no
-- por Server Action con el archivo en el body: el bug P0 del 2026-09-14
-- (docs/status-log/2026-09-14-reconciliacion-navegacion-rrhh.md) ya
-- demostro que el body de una Vercel Function tiene un techo real de
-- 4.5MB, y un PDF escaneado de cedula/titulo lo supera con frecuencia. Ese
-- mismo status-log dejo anotada esta solucion como pendiente -- se
-- implementa aca (ver apps/rrhh/.../documentos/actions.ts).
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('rrhh-documentos-privados', 'rrhh-documentos-privados', false)
on conflict (id) do nothing;

-- Sin policies de storage.objects para este bucket a proposito -- ni
-- lectura ni escritura para authenticated/anon. Todo pasa por Server
-- Actions con service_role (createSignedUploadUrl/createSignedUrl),
-- despues de requirePermission(). Ver plan aprobado, seccion "Storage
-- privado": "Sin ninguna politica de storage.objects para anon ni
-- authenticated".

-- -----------------------------------------------------------------------------
-- rrhh.empleado_documentos -- metadata de cada archivo. No particionada
-- (acotada por empleado, no un log de eventos ilimitado -- mismo criterio
-- que rrhh.contratos). Soft delete (eliminado_at) -- nunca DELETE fisico,
-- para conservar el rastro de auditoria de que hubo un documento aunque
-- se haya retirado.
-- -----------------------------------------------------------------------------
create table rrhh.empleado_documentos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references core.companies(id),
  empleado_id uuid not null references rrhh.empleados(id) on delete cascade,
  tipo_documento text not null check (tipo_documento in ('cedula', 'curriculum', 'titulo', 'contrato_firmado', 'otro')),
  storage_path text not null,
  nombre_original text not null,
  mime_type text not null,
  tamano_bytes bigint not null,
  subido_por uuid references auth.users(id),
  subido_at timestamptz not null default now(),
  eliminado_at timestamptz,
  eliminado_por uuid references auth.users(id)
);

comment on table rrhh.empleado_documentos is
  'Fase 4 (2026-09-16): metadata de documentos del legajo -- el archivo real vive en el bucket privado rrhh-documentos-privados (storage_path). Soft delete (eliminado_at) -- nunca DELETE fisico, conserva el rastro de auditoria. tipo_documento es un CHECK deliberadamente minimo (no un catalogo propio) -- ampliarlo requiere una regla de negocio nueva aprobada.';

create index empleado_documentos_empleado_id_idx on rrhh.empleado_documentos (empleado_id);
create index empleado_documentos_company_id_idx on rrhh.empleado_documentos (company_id);

alter table rrhh.empleado_documentos enable row level security;

-- Las filas eliminadas (soft delete) no dejan de ser visibles por RLS --
-- el filtro `eliminado_at is null` para "documentos vigentes" lo aplica
-- la query de la app (mismo patron que otras tablas del proyecto no
-- filtran estado en la policy). El permiso de auditoria/ver-eliminados no
-- existe todavia -- fuera de alcance de este bloque.
create policy "empleado_documentos: ver con permiso" on rrhh.empleado_documentos for select
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.documentos.ver'));

create policy "empleado_documentos: crear con permiso" on rrhh.empleado_documentos for insert
  to authenticated
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.documentos.subir'));

-- "Editar" aca es exclusivamente el soft delete (eliminado_at/eliminado_por)
-- -- no hay edicion de metadata de un documento ya subido (reemplazar =
-- subir uno nuevo + eliminar el viejo, nunca mutar el archivo in place).
create policy "empleado_documentos: eliminar con permiso" on rrhh.empleado_documentos for update
  to authenticated
  using (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.documentos.eliminar'))
  with check (core.has_permission((select auth.uid()), company_id, 'rrhh.expedientes.documentos.eliminar'));

grant select, insert, update on rrhh.empleado_documentos to authenticated;
