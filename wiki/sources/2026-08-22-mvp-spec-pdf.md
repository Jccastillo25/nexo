---
type: source
date: 2026-08-22
kind: pdf
ref: ../../MVP_SaaS_Control_Transporte_Especificacion_Tecnica.pdf
---

# Especificación técnica MVP (documento original)

Documento base del proyecto: define Ruta360 como SaaS multi-tenant de control operativo de
transporte, con un plan de **4 fases** (Base de Datos y Autenticación → Web App Móvil Conductor
→ Lógica de Negocio → Panel Admin) y un DDL inicial (Sección 4) que fue el punto de partida de
`supabase/migrations/0001_init_schema_auth_rls.sql`.

El orden real de construcción se desvió del plan: la Fase 4 (Panel Admin) se construyó antes que
la Fase 3 (Lógica de Negocio), a pedido explícito del usuario. Además se agregó una capa
completa no contemplada en el documento: el panel Super Admin (`/supadmin`) por encima de las
empresas.

No se pudo extraer el texto completo del PDF en este ingest (falta `poppler-utils` en el
entorno); este registro se basa en lo que ya estaba documentado en `docs/ROADMAP.md` sobre su
contenido. Si se necesita el detalle exacto de una sección del documento, reingerir con
extracción de texto disponible.

## Páginas que actualiza

- [[roadmap]]
- [[overview]]
