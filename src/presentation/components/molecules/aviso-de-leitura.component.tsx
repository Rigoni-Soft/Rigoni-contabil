import { Eye } from "lucide-react";

import { Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

export function AvisoDeLeitura() {
  return (
    <Linha
      alinhar="centro"
      espaco={2}
      role="status"
      className="shrink-0 rounded-lg border border-dashed border-border px-3 py-2"
    >
      <Eye aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <Texto variante="apoio">Leitura de supervisão. Só quem assumiu o atendimento responde.</Texto>
    </Linha>
  );
}
