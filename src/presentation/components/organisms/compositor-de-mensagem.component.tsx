import { SendHorizontal } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeAnexo } from "@/presentation/components/atoms/botao-de-anexo.component";
import { BotaoDeMicrofone } from "@/presentation/components/atoms/botao-de-microfone.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { BarraDeGravacao } from "@/presentation/components/molecules/barra-de-gravacao.component";
import { CampoTextarea } from "@/presentation/components/molecules/campo-textarea.component";
import { PreviaDeAnexo } from "@/presentation/components/molecules/previa-de-anexo.component";
import { SeletorDeEmoji } from "@/presentation/components/molecules/seletor-de-emoji.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

// Único compositor por tela: o id fixo liga o microfone desligado ao motivo escrito abaixo do campo.
const MOTIVO_MICROFONE_ID = "motivo-microfone-indisponivel";

type CompositorDeMensagemProps = {
  onEnviar: (texto: string) => void;
  enviando: boolean;
  erro?: string;
  // Muda a cada envio bem-sucedido: esvazia o campo (se falhou, o texto fica para tentar de novo).
  enviadas: number;
  // Seletor de emoji: estado, refs e inserção na posição do cursor vêm do Container.
  campoRef: React.Ref<HTMLTextAreaElement>;
  seletor: React.ComponentProps<typeof SeletorDeEmoji>;
  // Anexo: o arquivo escolhido (prévia) e como escolher/remover. Sem `anexo`, o envio é só texto;
  // com ele, o texto digitado vira a legenda e deixa de ser obrigatório.
  anexo?: { nome: string; tamanho: string; miniaturaUrl: string | null };
  aceitar: string;
  onAnexar: (arquivo: File) => void;
  onRemoverAnexo: () => void;
  // Gravação de áudio: sem `gravacao`, o campo não oferece o microfone. `gravando` troca o campo
  // pela barra de gravação; `indisponivel` explica por que o microfone está desligado.
  gravacao?: {
    gravando: boolean;
    parada: boolean;
    tempo: string;
    indisponivel?: string;
    // Acabou de gravar (enviou ou cancelou): o microfone volta a ter o foco.
    focarMicrofone?: boolean;
    onIniciar: () => void;
    onCancelar: () => void;
    onEnviar: () => void;
  };
  // Arrastar e soltar sobre o campo: `arrastando` destaca o campo; `ligacoes` vêm do Container.
  arraste?: {
    arrastando: boolean;
    ligacoes?: Pick<
      React.DOMAttributes<HTMLElement>,
      "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
    >;
  };
};

export function CompositorDeMensagem({
  onEnviar,
  enviando,
  erro,
  enviadas,
  campoRef,
  seletor,
  anexo,
  aceitar,
  onAnexar,
  onRemoverAnexo,
  gravacao,
  arraste,
}: CompositorDeMensagemProps) {
  if (gravacao?.gravando) {
    return (
      <Pilha espaco={1} className="shrink-0">
        <BarraDeGravacao
          tempo={gravacao.tempo}
          parada={gravacao.parada}
          enviando={enviando}
          onCancelar={gravacao.onCancelar}
          onEnviar={gravacao.onEnviar}
        />
        {/* Montada uma vez ao abrir a barra: o leitor de tela anuncia o início; o cronômetro não é
            região viva (anunciaria a cada segundo). Parada sem erro é o limite de tempo ou de tamanho. */}
        {!erro && (
          <Texto variante="nota" role="status">
            {gravacao.parada ? (
              "A gravação atingiu o limite e parou. Envie o áudio ou cancele."
            ) : (
              <>
                Gravando.
                <Caixa como="span" className="[@media(hover:none)]:hidden">
                  {" "}
                  Enter envia, Esc cancela.
                </Caixa>
              </>
            )}
          </Texto>
        )}
        {erro && <AvisoDeStatus tipo="erro" texto={erro} />}
      </Pilha>
    );
  }

  return (
    <Pilha espaco={1} className="shrink-0">
      {anexo && <PreviaDeAnexo {...anexo} onRemover={onRemoverAnexo} enviando={enviando} />}
      <Linha
        alinhar="centro"
        espaco={2}
        quebra
        como="form"
        key={enviadas}
        {...arraste?.ligacoes}
        className={cn(
          // Celular: o campo ocupa a linha toda e as ações (clipe, emoji, microfone, enviar) vão para baixo;
          // de sm em diante, tudo numa linha só.
          "rounded-2xl transition-shadow sm:flex-nowrap",
          arraste?.arrastando && "ring-2 ring-primary ring-offset-4 ring-offset-background",
        )}
        onSubmit={(evento) => {
          evento.preventDefault();
          onEnviar(String(new FormData(evento.currentTarget).get("texto")));
        }}
      >
        <BotaoDeAnexo aceitar={aceitar} disabled={enviando} onEscolher={onAnexar} />
        <SeletorDeEmoji {...seletor} disabled={enviando} />
        {gravacao && (
          <BotaoDeMicrofone
            disabled={enviando}
            motivo={gravacao.indisponivel}
            motivoId={MOTIVO_MICROFONE_ID}
            focarAoMontar={gravacao.focarMicrofone}
            onClick={gravacao.onIniciar}
          />
        )}
        <CampoTextarea
          ref={campoRef}
          id="mensagem-ao-cliente"
          rotulo="Mensagem ao cliente"
          rotuloOculto
          containerClassName="order-first basis-full sm:order-none sm:basis-0"
          name="texto"
          required={!anexo}
          rows={2}
          // Sem maxLength: ele conta unidades UTF-16 (emoji valeria 2); o limite é conferido ao enviar.
          placeholder={anexo ? "Legenda (opcional)" : "Escreva aqui"}
          className="min-h-12 resize-none rounded-2xl"
          onPaste={(evento) => {
            // Ctrl+V com imagem (print) na área de transferência vira anexo; texto cola normalmente.
            const arquivo = evento.clipboardData.files[0];
            if (arquivo) {
              evento.preventDefault();
              onAnexar(arquivo);
            }
          }}
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
          className="ml-auto rounded-full sm:ml-0"
          aria-label={anexo ? "Enviar arquivo" : "Enviar mensagem"}
          disabled={enviando}
        >
          <SendHorizontal aria-hidden="true" />
        </Button>
      </Linha>
      {gravacao?.indisponivel && (
        <Texto variante="nota" id={MOTIVO_MICROFONE_ID}>
          {gravacao.indisponivel}
        </Texto>
      )}
      {erro && <AvisoDeStatus tipo="erro" texto={erro} />}
    </Pilha>
  );
}
