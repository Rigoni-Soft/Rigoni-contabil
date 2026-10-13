import { SendHorizontal } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { CampoTextarea } from "@/presentation/components/molecules/campo-textarea.component";
import { SeletorDeEmoji } from "@/presentation/components/molecules/seletor-de-emoji.component";
import { Button } from "@/presentation/components/ui/button";

type CompositorDeMensagemProps = {
  onEnviar: (texto: string) => void;
  enviando: boolean;
  erro?: string;
  // Muda a cada envio bem-sucedido: esvazia o campo (se falhou, o texto fica para tentar de novo).
  enviadas: number;
  // Seletor de emoji: estado, refs e inserção na posição do cursor vêm do Container.
  campoRef: React.Ref<HTMLTextAreaElement>;
  seletor: React.ComponentProps<typeof SeletorDeEmoji>;
};

export function CompositorDeMensagem({
  onEnviar,
  enviando,
  erro,
  enviadas,
  campoRef,
  seletor,
}: CompositorDeMensagemProps) {
  return (
    <Caixa className="shrink-0 space-y-1">
      <Caixa
        como="form"
        key={enviadas}
        className="flex items-center gap-2"
        onSubmit={(evento) => {
          evento.preventDefault();
          onEnviar(String(new FormData(evento.currentTarget).get("texto")));
        }}
      >
        <SeletorDeEmoji {...seletor} disabled={enviando} />
        <CampoTextarea
          ref={campoRef}
          id="mensagem-ao-cliente"
          rotulo="Mensagem ao cliente"
          rotuloOculto
          name="texto"
          required
          rows={2}
          // Sem maxLength: ele conta unidades UTF-16 (emoji valeria 2); o limite é conferido ao enviar.
          placeholder="Escreva aqui"
          className="min-h-12 resize-none rounded-2xl"
          onKeyDown={(evento) => {
            // Enter envia, Shift+Enter quebra a linha; Enter de composição (IME) não envia. O Safari
            // entrega esse Enter com isComposing falso e keyCode 229.
            const compondo = evento.nativeEvent.isComposing || evento.keyCode === 229;
            if (evento.key === "Enter" && !evento.shiftKey && !compondo) {
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
      </Caixa>
      {erro && <AvisoDeStatus tipo="erro" texto={erro} />}
    </Caixa>
  );
}
