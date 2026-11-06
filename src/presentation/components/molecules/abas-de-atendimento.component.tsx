import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

// `contadorTexto`: o contador dito por extenso ("2 clientes"), para o leitor de tela; a pílula visual
// é só o número.
type AbaView<T extends string> = {
  valor: T;
  rotulo: string;
  contador: number;
  contadorTexto?: string;
};

type AbasDeAtendimentoProps<T extends string> = {
  abas: AbaView<T>[];
  ativa: T;
  onEscolher: (valor: T) => void;
};

// Padrão WAI-ARIA de abas: só a ativa entra na ordem do Tab; as setas, Home e End movem o foco entre
// as abas e já as ativam.
function aoTeclar<T extends string>(
  evento: React.KeyboardEvent<HTMLElement>,
  abas: AbaView<T>[],
  indice: number,
  onEscolher: (valor: T) => void,
) {
  const ultimo = abas.length - 1;
  const destino = {
    ArrowRight: indice === ultimo ? 0 : indice + 1,
    ArrowLeft: indice === 0 ? ultimo : indice - 1,
    Home: 0,
    End: ultimo,
  }[evento.key];
  if (destino === undefined) return;
  evento.preventDefault();
  onEscolher(abas[destino].valor);
  evento.currentTarget.parentElement
    ?.querySelectorAll<HTMLElement>('[role="tab"]')
    [destino]?.focus();
}

// Abas sobrepostas: só o painel da ativa fica na tela. O contador avisa de trabalho novo.
export function AbasDeAtendimento<T extends string>({
  abas,
  ativa,
  onEscolher,
}: AbasDeAtendimentoProps<T>) {
  return (
    <Linha role="tablist" aria-label="Atendimento" espaco={1} className="border-b border-border">
      {abas.map(({ valor, rotulo, contador, contadorTexto }, indice) => (
        <Caixa
          como="button"
          key={valor}
          type="button"
          role="tab"
          id={`aba-${valor}`}
          aria-selected={valor === ativa}
          aria-controls="painel-de-atendimento"
          tabIndex={valor === ativa ? 0 : -1}
          onClick={() => onEscolher(valor)}
          onKeyDown={(evento) => aoTeclar(evento, abas, indice, onEscolher)}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium pointer-coarse:min-h-11",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            valor === ativa
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {rotulo}
          {/* Zero some: o contador só aparece quando há o que fazer. */}
          {contador > 0 && (
            <>
              <Caixa
                como="span"
                aria-hidden="true"
                className="ml-2 rounded-full bg-primary px-1.5 text-xs text-primary-foreground"
              >
                {contador}
              </Caixa>
              <Texto como="span" variante="somenteLeitor">
                , {contadorTexto ?? contador}
              </Texto>
            </>
          )}
        </Caixa>
      ))}
    </Linha>
  );
}
