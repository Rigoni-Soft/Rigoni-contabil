import { AlertTriangle } from "lucide-react";

import { Button } from "@/presentation/components/ui/button";

type AlterarPapelProps = {
  nome: string;
  papelAlvo: "lider_setor" | "funcionario";
  pendente: boolean;
  erro?: string;
  aoAlterar: () => void;
};

// Alvo Funcionário = rebaixa o Líder; alvo Líder = promove o Funcionário (#57). Admin não
// tem ação (a página nem monta este componente pra ele).
export function AlterarPapel({ nome, papelAlvo, pendente, erro, aoAlterar }: AlterarPapelProps) {
  const promove = papelAlvo === "lider_setor";
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pendente}
        aria-label={
          promove ? `Promover ${nome} a Líder de setor` : `Rebaixar ${nome} a Funcionário`
        }
        onClick={aoAlterar}
      >
        {promove ? "Promover" : "Rebaixar"}
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
