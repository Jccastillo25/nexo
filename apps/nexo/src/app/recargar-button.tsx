"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nexo/ui";

/** "Recargar" del aviso de error del Launcher: vuelve a pedir la página al servidor. */
export default function RecargarButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button variant="secondary" size="sm" loading={isPending} onClick={() => startTransition(() => router.refresh())}>
      Recargar
    </Button>
  );
}
