import { Trash2 } from "lucide-react";

import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";

type LinhaDeAlteracaoProps = {
  indice: number;
  // Props do <input type="date"> (o `register` do formulário, já resolvido por quem monta).
  data: React.ComponentProps<"input">;
  erroData?: string;
  // O campo de arquivo é controlado pelo formulário; recebe o id que o rótulo aponta.
  campoArquivo: (id: string) => React.ReactNode;
  erroArquivo?: string;
  onRemover: () => void;
};

// Uma alteração contratual: data + arquivo, com a ação de remover. A numeração é 1-based.
export function LinhaDeAlteracao({
  indice,
  data,
  erroData,
  campoArquivo,
  erroArquivo,
  onRemover,
}: LinhaDeAlteracaoProps) {
  const idData = `alteracoesContratuais.${indice}.data`;
  const idArquivo = `alteracoesContratuais.${indice}.arquivo`;
  return (
    <Caixa className="flex flex-col gap-2 rounded-md border border-border p-3">
      <Caixa className="flex items-center justify-between gap-2">
        <Texto
          variante="corpo"
          como="span"
          className="font-medium"
        >{`Alteração ${indice + 1}`}</Texto>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remover alteração ${indice + 1}`}
          onClick={onRemover}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </Caixa>

      <Caixa className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Pilha espaco="campo">
          <Label htmlFor={idData}>{`Data da alteração ${indice + 1}`}</Label>
          <Input id={idData} type="date" aria-invalid={!!erroData} {...data} />
          {erroData && <FieldError>{erroData}</FieldError>}
        </Pilha>

        <Pilha espaco="campo">
          <Label htmlFor={idArquivo}>{`Arquivo da alteração ${indice + 1}`}</Label>
          {campoArquivo(idArquivo)}
          {erroArquivo && <FieldError>{erroArquivo}</FieldError>}
        </Pilha>
      </Caixa>
    </Caixa>
  );
}
