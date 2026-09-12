# Plan Maestro — FASE 8: Integración completa + integraciones internas

> Parte de [`PLAN_MAESTRO_IMPLEMENTACION_NEXO.md`](../PLAN_MAESTRO_IMPLEMENTACION_NEXO.md) (índice). Misma vigencia y jerarquía que el documento madre.

---

# 17. FASE 8 — Integración completa

```text
CRM pedido
→ Inventario
→ Fabricación si falta
→ producto terminado
→ despacho
→ conductor con contrato activo
→ Panel Web/Mobile
→ inspección/viaje/evidencia
→ cierre entrega
→ CRM actualizado
```

---

# 18. Integraciones internas

Las UIs no escriben directamente en schemas ajenos.

Ejemplos:

```text
core.fn_confirmar_pedido(...)
core.fn_solicitar_fabricacion(...)
core.fn_cerrar_orden_fabricacion(...)
core.fn_solicitar_despacho(...)
core.fn_cerrar_entrega(...)
```

Web y Mobile consumen la misma lógica.
