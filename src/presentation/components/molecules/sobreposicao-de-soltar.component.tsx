import { Paperclip } from "lucide-react";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";

// A moldura de segurança do talão sobre a região, enquanto um arquivo é arrastado até ela: o
// gesto de entregar um documento ganha a mesma moldura que o produto usa para os documentos do
// Cliente. Puramente visual (o arraste é de mouse): o caminho por teclado é o clipe.
// A camada externa posiciona (a moldura define `position: relative`, que venceria `absolute`).
export function SobreposicaoDeSoltar() {
  return (
    <Caixa aria-hidden="true" className="pointer-events-none absolute inset-0 z-10">
      <Caixa className="rc-guilloche-frame flex size-full items-center justify-center rounded-xl bg-background/75 motion-safe:animate-arraste-entrada">
        <Caixa className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
          <Paperclip className="size-4 text-primary" aria-hidden="true" />
          <Texto variante="destaque">Solte para anexar</Texto>
        </Caixa>
      </Caixa>
    </Caixa>
  );
}
