import { X } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { ACCEPT_DOCUMENTO } from "@/presentation/lib/accept-documento";
import { SUPERFICIE_DE_PAINEL } from "@/presentation/lib/superficie-de-painel";
import { cn } from "@/presentation/lib/utils";
import { hojeIso } from "@/shared/kernel/mes-atual";
import { AJUDA_NUMERO_ALTERACAO, NUMERO_MAXIMO } from "@/shared/kernel/numero-alteracao";

// Função estável: o ref não é refeito a cada render.
const marcarFocoInicial = (painel: HTMLElement | null) => painel?.setAttribute("autofocus", "");

type Valores = { numero: number; data: string; arquivo: File };

type AlteracoesContratuaisProps = {
  painelId: string;
  register: UseFormRegister<Valores>;
  control: Control<Valores>;
  errors: FieldErrors<Valores>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  // Confirmação exibida depois que o diálogo fecha.
  sucesso?: string;
  // Esc, clique fora ou X: descarta rascunho e erro.
  aoFechar: () => void;
  // Alerta não bloqueante (nº × data).
  aviso?: string;
  aoEscolherArquivo: (arquivo: File | undefined) => void;
};

// Admin em /clientes/[id], fora do formulário do cadastro operacional (sem <form> aninhado): o diálogo
// (popover nativo) de anexar, aberto pelo botão "Anexar alteração" que fica ao lado de "Abrir em nova
// aba" (BotaoAnexarAlteracao), pelo id do painel; mais a confirmação depois de anexar.
export function AlteracoesContratuais({
  painelId,
  register,
  control,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  sucesso,
  aoFechar,
  aviso,
  aoEscolherArquivo,
}: AlteracoesContratuaisProps) {
  return (
    // `contents`: sem caixa própria, para o espaço do diálogo fechado não abrir vão acima do formulário.
    <Caixa className="contents">
      {sucesso && <AvisoDeStatus tipo="sucesso" texto={sucesso} className="mb-4 text-sm" />}

      <Pilha
        espaco={4}
        id={painelId}
        popover="auto"
        // Foco inicial no diálogo ao abrir (atributo nativo, como em VisualizarDocumentoContratual).
        tabIndex={-1}
        ref={marcarFocoInicial}
        onToggle={(evento) => {
          if (evento.newState === "closed") aoFechar();
        }}
        role="dialog"
        aria-labelledby={`${painelId}-titulo`}
        className={cn(SUPERFICIE_DE_PAINEL, "max-h-[90dvh] w-[min(92vw,28rem)] overflow-auto")}
      >
        {/* Sem padding próprio: o cabeçalho fixo e o formulário trazem o deles. */}
        <Linha
          alinhar="centro"
          justificar="entre"
          espaco={2}
          className="sticky top-0 z-10 bg-background px-4 pt-4 pb-2"
        >
          <Texto variante="destaque" como="h2" id={`${painelId}-titulo`}>
            Anexar alteração contratual
          </Texto>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            popoverTarget={painelId}
            popoverTargetAction="hide"
            aria-label="Fechar"
            className="shrink-0 rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </Linha>

        <Pilha como="form" espaco={4} onSubmit={onSubmit} noValidate className="px-4 pb-4">
          <Controller
            control={control}
            name="arquivo"
            render={({ field: { onChange, onBlur, name, value } }) => (
              <CampoDeArquivo
                id={`${painelId}-arquivo`}
                rotulo="Arquivo (PDF ou DOCX, até 4 MB)"
                name={name}
                accept={ACCEPT_DOCUMENTO}
                file={value}
                onBlur={onBlur}
                erro={errors.arquivo?.message}
                onChange={(arquivo) => {
                  onChange(arquivo);
                  aoEscolherArquivo(arquivo);
                }}
              />
            )}
          />
          <CampoDeTexto
            id={`${painelId}-numero`}
            rotulo="Nº da alteração"
            type="number"
            inputMode="numeric"
            min={1}
            max={NUMERO_MAXIMO}
            step={1}
            ajuda={AJUDA_NUMERO_ALTERACAO}
            erro={errors.numero?.message}
            {...register("numero", { valueAsNumber: true })}
          />
          <CampoDeTexto
            id={`${painelId}-data`}
            rotulo="Data da alteração"
            type="date"
            max={hojeIso()}
            erro={errors.data?.message}
            aviso={aviso}
            {...register("data")}
          />
          {erroServidor && <AvisoDeStatus tipo="erro" texto={erroServidor} className="text-sm" />}
          <Button type="submit" disabled={pendente}>
            {pendente ? "Anexando…" : "Anexar"}
          </Button>
        </Pilha>
      </Pilha>
    </Caixa>
  );
}
