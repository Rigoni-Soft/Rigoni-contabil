import { Trash2 } from "lucide-react";

import { FieldError } from "@/presentation/components/atoms/field-error.component";
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
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{`Alteração ${indice + 1}`}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Remover alteração ${indice + 1}`}
          onClick={onRemover}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idData}>{`Data da alteração ${indice + 1}`}</Label>
          <Input id={idData} type="date" aria-invalid={!!erroData} {...data} />
          {erroData && <FieldError>{erroData}</FieldError>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idArquivo}>{`Arquivo da alteração ${indice + 1}`}</Label>
          {campoArquivo(idArquivo)}
          {erroArquivo && <FieldError>{erroArquivo}</FieldError>}
        </div>
      </div>
    </div>
  );
}
