/**
 * Utility to map dynamic variables in contract templates.
 * Supported variables: 
 * - {{first_name}}, {{last_name}}, {{full_name}}
 * - {{email}}, {{hire_date}}
 * - {{salary}}, {{contract_type}}
 * - {{shift_name}}, {{shift_start}}, {{shift_end}}
 */
export function mapTemplateVariables(
  content: string, 
  data: {
    employee: any,
    shift: any,
    contract: any
  }
) {
  const { employee, shift, contract } = data
  
  const mapping: Record<string, string> = {
    '{{first_name}}': employee.first_name || '',
    '{{last_name}}': employee.last_name || '',
    '{{full_name}}': `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
    '{{email}}': employee.email || 'N/A',
    '{{hire_date}}': contract.start_date || '',
    '{{salary}}': contract.salary?.toString() || '0',
    '{{contract_type}}': contract.contract_type || '',
    '{{shift_name}}': shift?.name || 'N/A',
    '{{shift_start}}': shift?.start_time || 'N/A',
    '{{shift_end}}': shift?.end_time || 'N/A',
    '{{date_now}}': new Date().toLocaleDateString('es-NI')
  }

  let result = content
  Object.entries(mapping).forEach(([key, value]) => {
    result = result.replace(new RegExp(key, 'g'), value)
  })

  return result
}
