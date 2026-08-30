-- Empresa "Materiales J Castillo" — dueña del CRM (unico tenant del modulo
-- por ahora; ver docs/MIGRATION_LOG.md).
insert into core.companies (name, slug)
values ('Materiales J Castillo', 'materiales-jcastillo')
on conflict (slug) do nothing;

-- Le habilita el panel (nexo) y el CRM.
insert into core.company_apps (company_id, app_id, enabled)
select c.id, a.id, true
from core.companies c
join core.apps a on a.slug in ('nexo', 'crm')
where c.slug = 'materiales-jcastillo'
on conflict do nothing;
