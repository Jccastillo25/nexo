// Bloque de formulario con titulo — reemplaza el <section className="...
// rounded-lg border ..."> que cada formulario (ej. AjustesForm.tsx) armaba
// a mano con su propia clase repetida.
export interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}
