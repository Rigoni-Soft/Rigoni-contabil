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

const MOTIVO_MICROFONE_ID = "motivo-microfone-indisponivel";

type CompositorDeMensagemProps = {
  onEnviar: (texto: string) => void;
  enviando: boolean;
  erro?: string;
  enviadas: number;
  campoRef: React.Ref<HTMLTextAreaElement>;
  seletor: React.ComponentProps<typeof SeletorDeEmoji>;
  anexo?: { nome: string; tamanho: string; miniaturaUrl: string | null };
  aceitar: string;
  onAnexar: (arquivo: File) => void;
  onRemoverAnexo: () => void;
  gravacao?: {
    gravando: boolean;
    parada: boolean;
    tempo: string;
    indisponivel?: string;
    focarMicrofone?: boolean;
    onIniciar: () => void;
    onCancelar: () => void;
    onEnviar: () => void;
  };
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
          placeholder={anexo ? "Legenda (opcional)" : "Escreva aqui"}
          className="min-h-12 resize-none rounded-2xl"
          onPaste={(evento) => {
            const arquivo = evento.clipboardData.files[0];
            if (arquivo) {
              evento.preventDefault();
              onAnexar(arquivo);
            }
          }}
          onKeyDown={(evento) => {
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
