import { Check } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Button } from "@/presentation/components/ui/button";
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
      <AvisoDeStatus tipo="sucesso" texto={mensagem} className="items-center text-sm" />
      {detalhes}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={onCadastrarNovo} className="sm:flex-1">
          {iconeNovo}
          Cadastrar outro
        </Button>
        {/* Provisório: leva para a home, ainda não existe uma tela própria do Setor para voltar. */}
        <LinkDeAcao href="/" className="sm:flex-1">
          <Check aria-hidden="true" />
          Finalizar
        </LinkDeAcao>
      </div>
    </div>
  );
}
