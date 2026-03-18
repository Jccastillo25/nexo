'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'empresa' | 'sucursal' | 'turno' | 'done'

export default function OnboardingPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('empresa')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Company data
  const [legalName, setLegalName]     = useState('')
  const [displayName, setDisplayName] = useState('')
  const [taxId, setTaxId]             = useState('')
  const [slug, setSlug]               = useState('')
  const [companyId, setCompanyId]     = useState<string | null>(null)

  // Branch data
  const [branchName, setBranchName]     = useState('')
  const [branchCode, setBranchCode]     = useState('')
  const [branchAddress, setBranchAddress] = useState('')
  const [branchId, setBranchId]         = useState<string | null>(null)

  // Shift data
  const [shiftName, setShiftName]         = useState('Jornada estándar')
  const [startTime, setStartTime]         = useState('08:00')
  const [endTime, setEndTime]             = useState('17:00')
  const [breakMinutes, setBreakMinutes]   = useState(60)
  const [toleranceIn, setToleranceIn]     = useState(5)
  const [toleranceOut, setToleranceOut]   = useState(5)

  function generateSlug(name: string) {
    if (!name) return ''
    return name
      .trim()
      .split(/\s+/)
      .map(word => word[0])
      .join('')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)

    const finalSlug = slug || generateSlug(displayName)

    const { data, error } = await supabase.rpc('create_company_with_owner', {
      p_legal_name:   legalName,
      p_display_name: displayName,
      p_slug:         finalSlug,
      p_tax_id:       taxId || null,
    })

    if (error) { setError(error.message); setLoading(false); return }

    setCompanyId(data as string)
    setStep('sucursal')
    // Auto-fill branch code for the first branch
    setBranchCode(`${finalSlug}-suc-01`)
    setLoading(false)
  }

  async function handleCreateBranch(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return
    setLoading(true); setError(null)

    const { data, error } = await supabase
      .from('branches')
      .insert({
        company_id: companyId,
        name:       branchName,
        code:       branchCode || null,
        address:    branchAddress || null,
      })
      .select('id')
      .single()

    if (error) { setError(error.message); setLoading(false); return }

    setBranchId(data.id)
    setStep('turno')
    setLoading(false)
  }

  async function handleCreateShift(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) return
    setLoading(true); setError(null)

    const { error } = await supabase
      .from('shifts')
      .insert({
        company_id:    companyId,
        name:          shiftName,
        start_time:    startTime,
        end_time:      endTime,
        break_minutes: breakMinutes,
        tolerance_in:  toleranceIn,
        tolerance_out: toleranceOut,
      })

    if (error) { setError(error.message); setLoading(false); return }

    setStep('done')
    setLoading(false)
  }

  const steps: Step[] = ['empresa', 'sucursal', 'turno', 'done']
  const stepIndex = steps.indexOf(step)

  if (step === 'done') {
    return (
      <div className="onboarding-shell">
        <div className="onboarding-card done-card">
          <div className="done-icon">🎉</div>
          <h2>¡Todo listo!</h2>
          <p>Tu empresa, sucursal y turno base han sido configurados.<br/>
          Ya puedes comenzar a registrar empleados y marcaciones.</p>
          <button className="btn-primary" onClick={() => { router.push('/dashboard'); router.refresh() }}>
            Ir al dashboard →
          </button>
        </div>
        {styles}
      </div>
    )
  }

  return (
    <div className="onboarding-shell">
      <div className="onboarding-card">
        {/* Progress */}
        <div className="progress-steps">
          {['Empresa', 'Sucursal', 'Turno'].map((label, i) => (
            <div key={label} className={`progress-step ${i <= stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
              <div className="step-dot">{i < stepIndex ? '✓' : i + 1}</div>
              <span>{label}</span>
            </div>
          ))}
        </div>

        {/* Step: Empresa */}
        {step === 'empresa' && (
          <>
            <div className="card-header">
              <h2>Configura tu empresa</h2>
              <p>Esta será la organización raíz del sistema.</p>
            </div>
            <form onSubmit={handleCreateCompany} className="form">
              <div className="field">
                <label>Nombre legal *</label>
                <input value={legalName} onChange={e => setLegalName(e.target.value)}
                  placeholder="Gestor360 S.A. de C.V." required />
              </div>
              <div className="field">
                <label>Nombre comercial *</label>
                <input value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setSlug(generateSlug(e.target.value)) }}
                  placeholder="Gestor360" required />
              </div>
              <div className="field">
                <label>Identificador fiscal</label>
                <input value={taxId} onChange={e => setTaxId(e.target.value)}
                  placeholder="RUC / RFC / NIT (opcional)" />
              </div>
              <div className="field">
                <label>Slug (identificador URL)</label>
                <input value={slug} onChange={e => setSlug(e.target.value)}
                  placeholder="grupo-ct" pattern="[a-z0-9\-]+" />
                <span className="field-hint">Solo letras minúsculas, números y guiones</span>
              </div>
              {error && <p className="form-error">{error}</p>}
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Creando…' : 'Continuar →'}
              </button>
            </form>
          </>
        )}

        {/* Step: Sucursal */}
        {step === 'sucursal' && (
          <>
            <div className="card-header">
              <h2>Primera sucursal</h2>
              <p>Agrega al menos una ubicación donde operas.</p>
            </div>
            <form onSubmit={handleCreateBranch} className="form">
              <div className="field">
                <label>Nombre de la sucursal *</label>
                <input value={branchName} onChange={e => setBranchName(e.target.value)}
                  placeholder="Casa matriz / Sucursal central" required />
              </div>
              <div className="field">
                <label>Código interno</label>
                <input value={branchCode} onChange={e => setBranchCode(e.target.value)}
                  placeholder="SUC-001 (opcional)" />
              </div>
              <div className="field">
                <label>Dirección</label>
                <input value={branchAddress} onChange={e => setBranchAddress(e.target.value)}
                  placeholder="Dirección física (opcional)" />
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="btn-row">
                <button type="button" className="btn-secondary" onClick={() => setStep('empresa')}>← Atrás</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Creando…' : 'Continuar →'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Step: Turno */}
        {step === 'turno' && (
          <>
            <div className="card-header">
              <h2>Turno base</h2>
              <p>Define el horario estándar de trabajo. Podrás crear más después.</p>
            </div>
            <form onSubmit={handleCreateShift} className="form">
              <div className="field">
                <label>Nombre del turno *</label>
                <input value={shiftName} onChange={e => setShiftName(e.target.value)} required />
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Entrada *</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Salida *</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label>Pausa (min)</label>
                  <input type="number" min={0} max={120} value={breakMinutes}
                    onChange={e => setBreakMinutes(+e.target.value)} />
                </div>
                <div className="field">
                  <label>Tolerancia entrada (min)</label>
                  <input type="number" min={0} max={60} value={toleranceIn}
                    onChange={e => setToleranceIn(+e.target.value)} />
                </div>
                <div className="field">
                  <label>Tolerancia salida (min)</label>
                  <input type="number" min={0} max={60} value={toleranceOut}
                    onChange={e => setToleranceOut(+e.target.value)} />
                </div>
              </div>
              {error && <p className="form-error">{error}</p>}
              <div className="btn-row">
                <button type="button" className="btn-secondary" onClick={() => setStep('sucursal')}>← Atrás</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Guardando…' : 'Finalizar ✓'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
      {styles}
    </div>
  )
}

const styles = (
  <style>{`
    .onboarding-shell {
      min-height: 100vh; background: var(--gray-50);
      display: flex; align-items: center; justify-content: center;
      padding: 2rem;
    }
    .onboarding-card {
      background: white; border-radius: var(--radius-xl);
      padding: 2.5rem; width: 100%; max-width: 520px;
      box-shadow: 0 4px 24px rgba(0,0,0,.07);
    }
    .done-card { text-align: center; }
    .done-icon { font-size: 3rem; margin-bottom: 1rem; }
    .done-card h2 { font-size: 1.75rem; font-weight: 700; margin-bottom: .5rem; }
    .done-card p { color: var(--gray-500); margin-bottom: 2rem; line-height: 1.7; }

    .progress-steps {
      display: flex; gap: 0; margin-bottom: 2rem;
      border-bottom: 1px solid var(--gray-100); padding-bottom: 1.5rem;
    }
    .progress-step {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; gap: .375rem;
      font-size: .75rem; color: var(--gray-400); font-weight: 500;
    }
    .step-dot {
      width: 28px; height: 28px; border-radius: 50%;
      background: var(--gray-100); color: var(--gray-400);
      display: flex; align-items: center; justify-content: center;
      font-size: .75rem; font-weight: 700; transition: all .2s;
    }
    .progress-step.active .step-dot { background: var(--brand-600); color: white; }
    .progress-step.done   .step-dot { background: var(--success); color: white; }
    .progress-step.active span, .progress-step.done span { color: var(--gray-700); }

    .card-header { margin-bottom: 1.5rem; }
    .card-header h2 { font-size: 1.375rem; font-weight: 700; margin-bottom: .25rem; }
    .card-header p  { color: var(--gray-500); font-size: .9375rem; }

    .form { display: flex; flex-direction: column; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: .3rem; }
    .field label { font-size: .8125rem; font-weight: 600; color: var(--gray-700); }
    .field input {
      padding: .625rem .875rem; border: 1.5px solid var(--gray-200);
      border-radius: var(--radius); font-size: .9375rem; outline: none;
      background: var(--gray-50); transition: border-color .15s;
    }
    .field input:focus { border-color: var(--brand-500); background: white; }
    .field-hint { font-size: .75rem; color: var(--gray-400); }
    .field-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .75rem; }

    .btn-row { display: flex; gap: .75rem; margin-top: .5rem; }
    .btn-primary {
      flex: 1; padding: .75rem; background: var(--brand-600); color: white;
      border: none; border-radius: var(--radius); font-size: .9375rem;
      font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .btn-primary:hover:not(:disabled) { background: var(--brand-700); }
    .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
    .btn-secondary {
      padding: .75rem 1.25rem; background: white; color: var(--gray-700);
      border: 1.5px solid var(--gray-200); border-radius: var(--radius);
      font-size: .9375rem; font-weight: 600; cursor: pointer; transition: background .15s;
    }
    .btn-secondary:hover { background: var(--gray-50); }
    .form-error {
      font-size: .8125rem; color: var(--danger);
      background: #fef2f2; border: 1px solid #fecaca;
      padding: .5rem .75rem; border-radius: var(--radius-sm);
    }
  `}</style>
)
