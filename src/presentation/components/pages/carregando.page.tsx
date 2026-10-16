import { Loader2 } from "lucide-react";

import { Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

// Mostrada pelo Next enquanto a tela seguinte busca os dados no servidor.
export function CarregandoPage() {
  return (
    <Linha
      alinhar="centro"
      como="main"
      role="status"
      className="min-h-dvh justify-center gap-2 bg-background"
    >
      <Loader2
        className="size-4 text-muted-foreground motion-safe:animate-spin"
        aria-hidden="true"
      />
      <Texto variante="apoio">Carregando…</Texto>
    </Linha>
  );
}
