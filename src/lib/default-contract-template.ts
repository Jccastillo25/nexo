// @ts-ignore: no available types for this module
import { NumerosALetras } from 'numero-a-letras';
import { formatCurrency } from './utils';

export const DEFAULT_CONTRACT_TEMPLATE = `
<div style="font-family: 'Times New Roman', serif; text-align: justify; line-height: 1.6; color: #000;">
  <p style="text-align: center; font-weight: bold; text-transform: uppercase;">
    CONTRATO DE TRABAJO INDIVIDUAL
  </p>
  <br />
  <p>
    Nosotros, por una parte la empresa <strong>Gestor360</strong>, representada en este acto por su representante legal, en adelante denominado EL EMPLEADOR, y por otra parte, <strong>{{EMPLEADO_NOMBRE_COMPLETO}}</strong>, portador del número de INSS: <strong>{{CLAUSULA_INSS}}</strong>, en adelante denominado EL TRABAJADOR, hemos convenido en celebrar el presente Contrato de Trabajo según las siguientes cláusulas y estipulaciones:
  </p>
  <br />
  <p><strong>PRIMERA (PUESTO Y FUNCIONES):</strong>
  <br />
  EL TRABAJADOR se compromete a prestar sus servicios en el puesto de <strong>{{PUESTO_TRABAJO}}</strong>, cumpliendo con eficiencia, puntualidad y responsabilidad las tareas inherentes a su cargo.
  </p>
  <br />
  <p><strong>SEGUNDA (JORNADA LABORAL):</strong>
  <br />
  El horario aplicable será: <strong>{{TURNO_NOMBRE}}</strong>, comprendido entre las horas: <strong>{{TURNO_HORARIO}}</strong>. EL TRABAJADOR declara estar de acuerdo con las condiciones y rotaciones pertinentes a la naturaleza comercial de EL EMPLEADOR.
  </p>
  <br />
  <p><strong>TERCERA (SALARIO):</strong>
  <br />
  EL EMPLEADOR pagará a EL TRABAJADOR, en concepto de salario, la suma de <strong>C$ {{SALARIO_NUMERO_C$}} ({{SALARIO_LETRAS}} CÓRDOBAS NETO)</strong>, pagadero de manera quincenal.
  </p>
  <br />
  <p><strong>CUARTA (VIGENCIA):</strong>
  <br />
  El presente contrato entra en vigor a partir del <strong>{{FECHA_INICIO}}</strong>. Ambas partes afirman conocer las leyes laborales vigentes de la República de Nicaragua.
  </p>
  <br />
  <p style="text-align: center; margin-top: 50px;">__________________________________<br />Firma EL EMPLEADOR</p>
  <p style="text-align: center; margin-top: 50px;">__________________________________<br />Firma EL TRABAJADOR</p>
</div>
`;

export type TemplateData = {
  employee: any;
  companyName: string;
  jobPosition: string;
  shiftName: string;
  shiftSchedule: string;
  salary: number;
  startDate: string;
  inss: string;
};

export function parseContractTemplate(templateBuffer: string | null | undefined, data: TemplateData): string {
  // Use default template as fallback
  let content = templateBuffer || DEFAULT_CONTRACT_TEMPLATE;
  
  const fullName = `${data.employee?.first_name || ''} ${data.employee?.last_name || ''}`.trim();
  const rawSalary = Number(data.salary) || 0;
  const formattedSalary = formatCurrency(rawSalary);
  
  const integerSalary = Math.floor(rawSalary);
  let salaryText = 'CERO';
  try {
    salaryText = NumerosALetras(integerSalary).toUpperCase();
  } catch (e) {
    salaryText = 'NO DISPONIBLE';
  }

  const inssClause = data.inss ? data.inss : 'PENDIENTE DE GRACIA LEY INSS';

  const replacements: Record<string, string> = {
    '{{EMPLEADO_NOMBRE_COMPLETO}}': fullName || 'N/A',
    '{{EMPRESA_NOMBRE}}': data.companyName || 'La Empresa',
    '{{PUESTO_TRABAJO}}': data.jobPosition || 'N/A',
    '{{TURNO_NOMBRE}}': data.shiftName || 'N/A',
    '{{TURNO_HORARIO}}': data.shiftSchedule || 'N/A',
    '{{SALARIO_NUMERO_C$}}': formattedSalary,
    '{{SALARIO_LETRAS}}': salaryText,
    '{{CLAUSULA_INSS}}': inssClause,
    '{{FECHA_INICIO}}': data.startDate ? new Date(data.startDate).toLocaleDateString('es-NI') : 'N/A',
  };

  Object.entries(replacements).forEach(([key, value]) => {
    // Also strip possible internal html wrapper artifacts from WYSIWYG if needed
    const safeValue = value; 
    content = content.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), safeValue);
  });

  return content;
}
