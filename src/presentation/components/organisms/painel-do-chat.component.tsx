import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type PainelDoChatProps = {
  // `vazio`: nenhuma conversa aberta; `abrindo`/`erro`: a primeira leitura; `pronto`: o chat.
  estado: "vazio" | "abrindo" | "erro" | "pronto";
  // "Voltar à lista", só em tela estreita.
  onVoltar: () => void;
  // As regiões do chat (cabeçalho, mensagens, compositor), quando `pronto`.
  children?: React.ReactNode;
};

// O centro da tela Atendimento. Em tela estreita só aparece com conversa aberta; em tela larga
// está sempre lá, com o convite quando não há conversa.
export function PainelDoChat({ estado, onVoltar, children }: PainelDoChatProps) {
  return (
    <Caixa
      como="section"
      aria-label="Conversa"
      className={cn(
        "min-h-0 flex-1 flex-col gap-3 lg:flex",
        estado === "vazio" ? "hidden lg:flex" : "flex",
      )}
    >
      {estado !== "vazio" && (
        <Caixa className="shrink-0 lg:hidden">
          <Caixa
            como="button"
            type="button"
            onClick={onVoltar}
            className="inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
          >
            ← Voltar à lista
          </Caixa>
        </Caixa>
      )}
      {estado === "vazio" && (
        <Texto variante="apoio" className="m-auto">
          Escolha um atendimento para conversar.
        </Texto>
      )}
      {estado === "abrindo" && (
        <Texto variante="apoio" role="status">
          Abrindo a conversa…
        </Texto>
      )}
      {estado === "erro" && (
        <Texto variante="alerta" role="alert">
          Não foi possível abrir a conversa.
        </Texto>
      )}
      {estado === "pronto" && children}
    </Caixa>
  );
}
