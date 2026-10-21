import { Trash2 } from "lucide-react";

import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { NUMERO_MAXIMO } from "@/shared/kernel/numero-alteracao";

type LinhaDeAlteracaoProps = {
  indice: number;
  // Props do <input type="number"> do nº da alteração (o `register` com `valueAsNumber`).
  numero: React.ComponentProps<"input">;
  erroNumero?: string;
  // Props do <input type="date"> (o `register` do formulário, já resolvido por quem monta).
  data: React.ComponentProps<"input">;
  erroData?: string;
  // O campo de arquivo é controlado pelo formulário; o id dele é `alteracoesContratuais.<i>.arquivo`
  // (o rótulo aponta para ele); com erro, o id do alerta é `<id>-erro` (aria-describedby).
  arquivo: React.ReactNode;
  erroArquivo?: string;
  onRemover: () => void;
};

// Uma alteração contratual: data + arquivo, com a ação de remover. A numeração é 1-based.
export function LinhaDeAlteracao({
  indice,
  numero,
  erroNumero,
  data,
  erroData,
  arquivo,
  erroArquivo,
  onRemover,
}: LinhaDeAlteracaoProps) {
  const idNumero = `alteracoesContratuais.${indice}.numero`;
  const idData = `alteracoesContratuais.${indice}.data`;
  const idArquivo = `alteracoesContratuais.${indice}.arquivo`;
  // O erro de cada campo é ligado ao input por aria-describedby (o alerta só soa quando aparece).
  const idAjudaNumero = `${idNumero}-ajuda`;
  const idErroNumero = `${idNumero}-erro`;
  const idErroData = `${idData}-erro`;
  const idErroArquivo = `${idArquivo}-erro`;
  return (
    <Caixa className="flex flex-col gap-2 rounded-md border border-border p-3">
      <Linha alinhar="centro" justificar="entre" espaco={2}>
        <Texto
          variante="corpo"
          como="span"
          className="font-medium"
        >{`Alteração ${indice + 1}`}</Texto>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remover alteração ${indice + 1}`}
          onClick={onRemover}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </Linha>

      <Grade colunas="1>2" espaco={3}>
        <Pilha espaco="campo">
          <Label htmlFor={idNumero}>{`Nº da alteração ${indice + 1}`}</Label>
          <Input
            id={idNumero}
            type="number"
            inputMode="numeric"
            min={1}
            max={NUMERO_MAXIMO}
            step={1}
            aria-invalid={!!erroNumero}
            aria-describedby={erroNumero ? `${idAjudaNumero} ${idErroNumero}` : idAjudaNumero}
            {...numero}
          />
          <Texto variante="nota" id={idAjudaNumero}>
            Sugerido pelo início do nome do arquivo (ex.: 2-alteracao.pdf) ou o próximo da
            sequência. Pode editar.
          </Texto>
          {erroNumero && <FieldError id={idErroNumero}>{erroNumero}</FieldError>}
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor={idData}>{`Data da alteração ${indice + 1}`}</Label>
          <Input
            id={idData}
            type="date"
            aria-invalid={!!erroData}
            aria-describedby={erroData ? idErroData : undefined}
            {...data}
          />
          {erroData && <FieldError id={idErroData}>{erroData}</FieldError>}
        </Pilha>

        {/* Arquivo ocupa a linha inteira: nº e data pareados em cima, o nome do arquivo respira embaixo. */}
        <Pilha espaco="campo" className="sm:col-span-2">
          <Label htmlFor={idArquivo}>{`Arquivo da alteração ${indice + 1}`}</Label>
          {arquivo}
          {erroArquivo && <FieldError id={idErroArquivo}>{erroArquivo}</FieldError>}
        </Pilha>
      </Grade>
    </Caixa>
  );
}
