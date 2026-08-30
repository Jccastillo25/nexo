export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-900 px-6 text-center text-slate-100">
      <h1 className="text-2xl font-bold">Sin conexión</h1>
      <p className="text-slate-300">
        No hay señal en este momento. Tus registros de viaje se guardarán en el
        dispositivo y se enviarán automáticamente al recuperar la conexión.
      </p>
    </main>
  );
}
