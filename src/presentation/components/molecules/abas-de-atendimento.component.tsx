import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { cn } from "@/presentation/lib/utils";

export type AbaView = { valor: string; rotulo: string; contador: number };

type AbasDeAtendimentoProps = {
  abas: AbaView[];
  ativa: string;
  onEscolher: (valor: string) => void;
};

// Abas sobrepostas: só o painel da ativa fica na tela. O contador avisa de trabalho novo.
export function AbasDeAtendimento({ abas, ativa, onEscolher }: AbasDeAtendimentoProps) {
  return (
    <Linha role="tablist" aria-label="Atendimento" espaco={1} className="border-b border-border">
      {abas.map(({ valor, rotulo, contador }) => (
        <Caixa
          como="button"
          key={valor}
          type="button"
          role="tab"
          id={`aba-${valor}`}
          aria-selected={valor === ativa}
          aria-controls="painel-de-atendimento"
          onClick={() => onEscolher(valor)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium pointer-coarse:min-h-11",
            valor === ativa
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {rotulo}
          {/* Zero some: o contador só aparece quando há o que fazer. */}
          {contador > 0 && (
            <Caixa
              como="span"
              className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
            >
              {contador}
            </Caixa>
          )}
        </Caixa>
      ))}
    </Linha>
  );
}
