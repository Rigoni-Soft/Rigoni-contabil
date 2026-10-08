import { SendHorizontal } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/molecules/aviso-de-status.component";
import { CampoTextarea } from "@/presentation/components/molecules/campo-textarea.component";
import { Button } from "@/presentation/components/ui/button";

type CompositorDeMensagemProps = {
  onEnviar: (texto: string) => void;
  enviando: boolean;
  erro?: string;
  // Muda a cada envio bem-sucedido: esvazia o campo (se falhou, o texto fica para tentar de novo).
  enviadas: number;
};

export function CompositorDeMensagem({
  onEnviar,
  enviando,
  erro,
  enviadas,
}: CompositorDeMensagemProps) {
  return (
    <div className="shrink-0 space-y-1">
      <form
        key={enviadas}
        className="flex items-end gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          onEnviar(String(new FormData(evento.currentTarget).get("texto")));
        }}
      >
        <CampoTextarea
          id="mensagem-ao-cliente"
          rotulo="Mensagem ao cliente"
          rotuloOculto
          name="texto"
          required
          rows={2}
          maxLength={4096}
          placeholder="Escreva uma mensagem ao cliente..."
          className="min-h-12 resize-none rounded-2xl"
          onKeyDown={(evento) => {
            // Enter envia, Shift+Enter quebra a linha (como nos chats).
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              evento.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="rounded-full"
          aria-label="Enviar mensagem"
          disabled={enviando}
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
      {erro && <AvisoDeStatus tipo="erro" texto={erro} />}
    </div>
  );
}
