import { UserPermissions } from '@/types/security';

/**
 * Enmascara campos sensibles (salarios, montos) si el usuario no tiene permisos.
 * Soporta tanto objetos individuales como arreglos de datos.
 */
export function maskProtectedFields<T>(
  data: T,
  permissions: Partial<UserPermissions> | null
): T {
  if (!data || permissions?.can_view_salary) return data;

  const maskValue = (val: any) => (typeof val === 'number' ? 0 : '***');

  const processObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(processObject);
    }

    const newObj = { ...obj };
    for (const key in newObj) {
      const lowerKey = key.toLowerCase();
      
      // Enmascaramiento de campos directos (Salarios, Montos)
      if (
        lowerKey.includes('salary') || 
        lowerKey.includes('amount') || 
        lowerKey.includes('payment') ||
        lowerKey.includes('monto') ||
        lowerKey.includes('salario')
      ) {
        newObj[key] = maskValue(newObj[key]);
      }

      // Enmascaramiento de AGREGADOS (SUM, AVG, MIN, MAX)
      if (
        lowerKey.startsWith('avg_') || 
        lowerKey.startsWith('sum_') || 
        lowerKey.startsWith('total_') ||
        lowerKey.includes('_agg')
      ) {
        newObj[key] = maskValue(newObj[key]);
      }

      // Procesamiento recursivo por si hay objetos anidados (Ej: profiles en logs)
      if (typeof newObj[key] === 'object') {
        newObj[key] = processObject(newObj[key]);
      }
    }
    return newObj;
  };

  return processObject(data);
}

/**
 * Prepara los metadatos de auditoría dual para acciones de suplantación.
 */
export function getAuditMetadata(
  profileId: string, 
  impersonatorId?: string | null
) {
  return {
    profile_id: profileId,
    impersonator_id: impersonatorId || null,
    is_impersonated: !!impersonatorId,
    timestamp: new Date().toISOString(),
  };
}
