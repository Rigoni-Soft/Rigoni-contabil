import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";

const LARGURA = {
  conta: "max-w-md",
  lista: "max-w-3xl",
  cadastro: "w-full max-w-4xl",
  conteudo: "w-[90%]",
  ampla: "w-full max-w-screen-2xl",
} as const;

type TelaDeTrabalhoTemplateProps = {
  header: React.ReactNode;
  nav?: React.ReactNode;
  largura: keyof typeof LARGURA;
  cabecalho?: React.ReactNode;
  conteudo: React.ReactNode;
};

export function TelaDeTrabalhoTemplate({
  header,
  nav,
  largura,
  cabecalho,
  conteudo,
}: TelaDeTrabalhoTemplateProps) {
  return (
    <Caixa className="min-h-dvh bg-background">
      {header}
      {nav}
      <Caixa como="main" className={cn("mx-auto px-4 py-8 sm:px-6", LARGURA[largura])}>
        {cabecalho}
        {conteudo}
      </Caixa>
    </Caixa>
  );
}
