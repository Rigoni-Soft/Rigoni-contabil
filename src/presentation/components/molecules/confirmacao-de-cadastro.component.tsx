import Link from "next/link";
import { Check, CheckCircle2 } from "lucide-react";

import { Button, buttonVariants } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type ConfirmacaoDeCadastroProps = {
  mensagem: React.ReactNode;
  // Conteúdo extra abaixo da mensagem (ex.: a senha provisória).
  detalhes?: React.ReactNode;
  iconeNovo?: React.ReactNode;
  largura: "sm" | "md";
  onCadastrarNovo: () => void;
};

// Confirmação de cadastro com as duas saídas: continuar ("Cadastrar outro") ou encerrar.
export function ConfirmacaoDeCadastro({
  mensagem,
  detalhes,
  iconeNovo,
  largura,
  onCadastrarNovo,
}: ConfirmacaoDeCadastroProps) {
  return (
    <div
      className={cn(
        "mx-auto flex flex-col gap-3 rounded-lg border border-border bg-card p-4",
        largura === "sm" ? "max-w-sm" : "max-w-md",
      )}
    >
      <p className="flex items-center gap-1.5 text-sm text-primary">
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{mensagem}</span>
      </p>
      {detalhes}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={onCadastrarNovo} className="sm:flex-1">
          {iconeNovo}
          Cadastrar outro
        </Button>
        {/* Provisório: leva para a home, ainda não existe uma tela própria do Setor para voltar. */}
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "sm:flex-1")}>
          <Check aria-hidden="true" />
          Finalizar
        </Link>
      </div>
    </div>
  );
}
