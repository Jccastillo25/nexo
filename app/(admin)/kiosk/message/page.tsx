import { createClient } from '@/lib/supabase/server'
import { KioskSettingsForm } from '../../settings/_components/kiosk-settings-form'
import { MessageSquare, Info } from 'lucide-react'

export default async function KioskMessagePage() {
  const supabase = await createClient()
  
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'kiosk_custom_message')
    .single()

  const customMessage = setting?.value || 'Gracias por su puntualidad'

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
          <MessageSquare className="w-8 h-8 text-indigo-600" />
          Mensaje del Kiosco
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          Personalice el mensaje de bienvenida y agradecimiento que verán sus empleados.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <KioskSettingsForm customMessage={customMessage} />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 rounded-3xl p-6">
            <h3 className="font-bold text-indigo-900 dark:text-indigo-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> Vista Previa
            </h3>
            <div className="bg-indigo-600/10 dark:bg-indigo-400/10 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800 italic text-sm text-indigo-800 dark:text-indigo-300 text-center">
              "{customMessage}"
            </div>
            <p className="text-[11px] text-indigo-600/60 dark:text-indigo-400/60 mt-4 leading-relaxed">
              Este mensaje aparecerá en la pantalla central del kiosko, justo después de que el empleado realice su marcación.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
