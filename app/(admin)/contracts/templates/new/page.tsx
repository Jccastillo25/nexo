'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createTemplate } from '../../../../actions/contracts';

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) {
      toast.error('Por favor complete todos los campos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createTemplate(name, content);
      if (result.error) {
        throw new Error(result.error);
      }
      toast.success('Plantilla guardada exitosamente');
      router.push('/contracts');
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar la plantilla');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center gap-4">
        <Link 
          href="/contracts/templates"
          className="p-3 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
        >
          <svg className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Nueva Plantilla Legal</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Borrador de Contrato</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-700 mb-2">Nombre de Plantilla</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Contrato Indefinido Operativo"
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-black uppercase tracking-widest text-slate-700 mb-2">Contenido Legal (HTML / WYSIWYG)</label>
            <textarea 
              rows={15}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe aquí el contenido..."
              className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-5 py-4 text-sm font-medium text-slate-900 outline-none transition-all hover:bg-white focus:border-slate-900 focus:bg-white resize-y font-mono"
              required
            />
          </div>

          <div className="pt-6 border-t border-slate-200 flex justify-end">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl bg-slate-900 px-8 py-4 text-sm font-black tracking-wide text-white shadow-xl shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Plantilla'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
