import { AlertTriangle } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type AlterarPapelProps = {
  nome: string;
  papel: string;
  pendente: boolean;
  erro?: string;
  aoAlterar: () => void;
};

// Líder -> rebaixa a Funcionário; Funcionário -> promove a Líder (#57). Admin não
// tem ação (a página nem monta este componente pra ele).
export function AlterarPapel({ nome, papel, pendente, erro, aoAlterar }: AlterarPapelProps) {
  const ehLider = papel === "lider_setor";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendente}
        aria-label={
          ehLider ? `Rebaixar ${nome} a Funcionário` : `Promover ${nome} a Líder de setor`
        }
        onClick={aoAlterar}
      >
        {ehLider ? "Rebaixar" : "Promover"}
      </Button>
      {erro && (
        <p role="alert" className="flex max-w-64 items-start gap-1 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {erro}
        </p>
      )}
    </div>
  );
}
