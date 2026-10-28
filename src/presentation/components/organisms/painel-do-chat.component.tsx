import { ArrowDown } from "lucide-react";

import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type PainelDoChatProps = {
  // `vazio`: nenhuma conversa aberta; `abrindo`/`erro`: a primeira leitura; `pronto`: o chat.
  estado: "vazio" | "abrindo" | "erro" | "pronto";
  // "Voltar à lista", só em tela estreita.
  onVoltar: () => void;
  // Em tela estreita as ações ficam depois do campo de resposta: com `ancoraDasAcoes` há um atalho
  // para elas no topo do chat (omitido quando a conversa não tem ações, ex.: encerrada).
  ancoraDasAcoes?: string;
  // As regiões do chat (cabeçalho, mensagens, compositor), quando `pronto`.
  children?: React.ReactNode;
};

// O centro da tela Atendimento. Em tela estreita só aparece com conversa aberta; em tela larga
// está sempre lá, com o convite quando não há conversa.
export function PainelDoChat({ estado, onVoltar, ancoraDasAcoes, children }: PainelDoChatProps) {
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
        <Linha justificar="entre" alinhar="centro" espaco={3} className="shrink-0 lg:hidden">
          <Caixa
            como="button"
            type="button"
            onClick={onVoltar}
            className="inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
          >
            ← Voltar à lista
          </Caixa>
          {estado === "pronto" && ancoraDasAcoes && (
            <Caixa
              como="a"
              href={`#${ancoraDasAcoes}`}
              className="inline-flex min-h-6 items-center gap-1 text-sm font-medium text-primary hover:underline pointer-coarse:min-h-11"
            >
              Ir para as ações
              <ArrowDown aria-hidden="true" className="size-4" />
            </Caixa>
          )}
        </Linha>
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
