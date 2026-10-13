import Link from "next/link";

import { Button, buttonVariants } from "@/presentation/components/ui/button";

type AcoesDoFormularioProps = {
  pendente: boolean;
  onLimpar: () => void;
  // Sem callback, "Cancelar" é um link para "/". Com callback (formulário inline na busca do
  // dashboard, #35) já estamos em "/": quem abriu o painel o fecha direto.
  onCancelar?: () => void;
};

// Salvar / Limpar / Cancelar, na ordem do contrato de ações de formulário do DESIGN.md.
export function AcoesDoFormulario({ pendente, onLimpar, onCancelar }: AcoesDoFormularioProps) {
  return (
    <div className="flex flex-wrap gap-2 sm:col-span-2">
      <Button type="submit">{pendente ? "Salvando..." : "Salvar"}</Button>
      <Button type="button" variant="outline" onClick={onLimpar} disabled={pendente}>
        Limpar
      </Button>
      {onCancelar ? (
        <Button type="button" variant="destructive" onClick={onCancelar} disabled={pendente}>
          Cancelar
        </Button>
      ) : (
        <Link href="/" className={buttonVariants({ variant: "destructive" })}>
          Cancelar
        </Link>
      )}
    </div>
  );
}
