import { Trash2 } from "lucide-react";

import { Caixa, Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";
import { AJUDA_NUMERO_ALTERACAO, NUMERO_MAXIMO } from "@/shared/kernel/numero-alteracao";

export const idErroDoCampo = (idDoCampo: string) => `${idDoCampo}-erro`;

type LinhaDeAlteracaoProps = {
  indice: number;
  numero: React.ComponentProps<"input">;
  erroNumero?: string;
  data: React.ComponentProps<"input">;
  erroData?: string;
  arquivo: React.ReactNode;
  erroArquivo?: string;
  onRemover: () => void;
};

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
  const idAjudaNumero = `${idNumero}-ajuda`;
  const idErroNumero = idErroDoCampo(idNumero);
  const idErroData = idErroDoCampo(idData);
  const idErroArquivo = idErroDoCampo(idArquivo);
  return (
    <Caixa
      role="group"
      aria-label={`Alteração ${indice + 1}`}
      className="flex flex-col gap-2 rounded-md border border-border p-3"
    >
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

      <Grade colunas="1>2>4" espaco={3}>
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

        <Pilha espaco="campo" className="sm:col-span-2">
          <Label htmlFor={idArquivo}>{`Arquivo da alteração ${indice + 1}`}</Label>
          {arquivo}
          {erroArquivo && <FieldError id={idErroArquivo}>{erroArquivo}</FieldError>}
        </Pilha>
      </Grade>
      <Texto variante="nota" id={idAjudaNumero}>
        {AJUDA_NUMERO_ALTERACAO}
      </Texto>
    </Caixa>
  );
}
