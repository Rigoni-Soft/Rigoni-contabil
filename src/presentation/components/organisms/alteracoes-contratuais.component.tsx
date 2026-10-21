import { Paperclip, X } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { NUMERO_MAXIMO } from "@/shared/kernel/numero-alteracao";

// PDF ou DOCX — dica do navegador; a validação de verdade fica no schema Zod.
const ACCEPT_DOCUMENTO =
  ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type Valores = { numero: number; data: string; arquivo: File };

type AlteracoesContratuaisProps = {
  painelId: string;
  // Do maior nº para o menor.
  alteracoes: { numero: number; rotulo: string; arquivo: string }[];
  register: UseFormRegister<Valores>;
  control: Control<Valores>;
  errors: FieldErrors<Valores>;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  erroServidor?: string;
  // Alerta não bloqueante (nº × data).
  aviso?: string;
  aoEscolherArquivo: (arquivo: File | undefined) => void;
};

// Seção do Admin em /clientes/[id], fora do formulário do cadastro operacional (sem <form> aninhado):
// lista das alterações + botão que abre o diálogo (popover nativo) de anexar.
export function AlteracoesContratuais({
  painelId,
  alteracoes,
  register,
  control,
  errors,
  onSubmit,
  pendente,
  erroServidor,
  aviso,
  aoEscolherArquivo,
}: AlteracoesContratuaisProps) {
  return (
    <Pilha como="section" espaco={3} aria-labelledby={`${painelId}-secao`}>
      <Linha alinhar="centro" justificar="entre" espaco={2} quebra>
        <Texto variante="destaque" como="h2" id={`${painelId}-secao`}>
          Alterações contratuais
        </Texto>
        <Button type="button" variant="outline" popoverTarget={painelId}>
          <Paperclip className="size-4" aria-hidden="true" />
          Anexar alteração
        </Button>
      </Linha>

      {alteracoes.length === 0 ? (
        <Texto variante="nota">Nenhuma alteração anexada.</Texto>
      ) : (
        <ListaComDivisores cartao>
          {alteracoes.map(({ numero, rotulo, arquivo }) => (
            <Caixa como="li" key={numero} className="px-3 py-2 text-sm">
              {rotulo}
              <Texto variante="nota" como="span" className="block">
                {arquivo}
              </Texto>
            </Caixa>
          ))}
        </ListaComDivisores>
      )}

      <Pilha
        espaco={4}
        id={painelId}
        popover="auto"
        role="dialog"
        aria-labelledby={`${painelId}-titulo`}
        className="m-auto max-h-[90dvh] w-[min(92vw,28rem)] overflow-auto rounded-xl border border-border bg-background p-4 text-foreground backdrop:bg-overlay"
      >
        <Linha alinhar="centro" justificar="entre" espaco={2}>
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

        <Pilha como="form" espaco={4} onSubmit={onSubmit} noValidate>
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
            erro={errors.numero?.message}
            {...register("numero", { valueAsNumber: true })}
          />
          <CampoDeTexto
            id={`${painelId}-data`}
            rotulo="Data da alteração"
            type="date"
            erro={errors.data?.message}
            aviso={aviso}
            {...register("data")}
          />
          {erroServidor && <AvisoDeStatus tipo="erro" texto={erroServidor} className="text-sm" />}
          <Caixa>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Anexando..." : "Anexar"}
            </Button>
          </Caixa>
        </Pilha>
      </Pilha>
    </Pilha>
  );
}
