import { SendHorizontal } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/molecules/aviso-de-status.component";
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
    <div className="shrink-0 space-y-1">
      <form
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
          // 16px no celular: abaixo disso o iOS dá zoom ao focar o campo.
          className="min-h-12 resize-none rounded-2xl text-base sm:text-sm"
          onKeyDown={(evento) => {
            // Enter envia, Shift+Enter quebra a linha (como nos chats); Enter que confirma
            // composição (IME, teclado de celular) não envia.
            if (evento.key === "Enter" && !evento.shiftKey && !evento.nativeEvent.isComposing) {
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
