import { Bell, X } from "lucide-react";

import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  ItemDeAviso,
  type AvisoDeCadastro,
} from "@/presentation/components/molecules/item-de-aviso.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type SinoAvisosProps = {
  // Id do modal (e base dos ids internos); único na página.
  painelId: string;
  contador: number;
  // Texto para leitor de tela quando chegam avisos novos; vazio fora disso.
  anuncio: string;
  avisos: AvisoDeCadastro[];
  estado: "carregando" | "erro" | "pronto";
  temMais: boolean;
  carregandoMais: boolean;
  // Chamado ao abrir: o Container carrega a lista. Abrir não marca nada como visto.
  aoAbrir: () => void;
  aoFechar: () => void;
  aoSelecionar: (aviso: AvisoDeCadastro) => void;
  aoCarregarMais: () => void;
  aoTentarDeNovo: () => void;
};

const TETO_DO_SELO = 99;

// Sino fixo do cabeçalho (DESIGN.md → Sino de Avisos de cadastro): maior que o ícone padrão de
// 44 px, com selo de contador e cor de destaque enquanto houver aviso não visto. Abre direto um
// <dialog> modal (o Container o abre com showModal: foco preso, fundo inerte, Esc fecha) com a
// lista; só o clique no aviso o marca como visto.
export function SinoAvisos({
  painelId,
  contador,
  anuncio,
  avisos,
  estado,
  temMais,
  carregandoMais,
  aoAbrir,
  aoFechar,
  aoSelecionar,
  aoCarregarMais,
  aoTentarDeNovo,
}: SinoAvisosProps) {
  const destaque = contador > 0;
  return (
    <>
      {/* O polling muda o contador sem o foco passar pelo sino: a região avisa o leitor de tela. */}
      <Texto variante="somenteLeitor" como="span" role="status">
        {anuncio}
      </Texto>
      <Button
        type="button"
        variant="outline"
        onClick={aoAbrir}
        aria-label={destaque ? `Avisos de cadastro, ${contador} não vistos` : "Avisos de cadastro"}
        data-destaque={destaque}
        className={cn(
          "relative size-12 shrink-0 rounded-full pointer-coarse:size-12",
          destaque && "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        <Bell aria-hidden="true" className="size-6" />
        {destaque && (
          <Caixa
            como="span"
            data-testid="selo-avisos"
            aria-hidden="true"
            className="absolute -top-1 -right-1 flex min-w-6 items-center justify-center rounded-full border-2 border-background bg-destructive px-1 text-xs font-bold text-destructive-foreground"
          >
            {contador > TETO_DO_SELO ? `${TETO_DO_SELO}+` : contador}
          </Caixa>
        )}
      </Button>
      <Caixa
        como="dialog"
        id={painelId}
        aria-labelledby={`${painelId}-titulo`}
        // O conteúdo ocupa toda a caixa: só o clique no véu tem o próprio <dialog> como alvo.
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) aoFechar();
        }}
        className="m-auto max-h-[80dvh] w-[min(92vw,32rem)] flex-col overflow-hidden rounded-xl border border-border bg-background p-0 text-foreground backdrop:bg-overlay open:flex"
      >
        <Linha alinhar="centro" justificar="entre" className="border-b border-border px-4 py-1">
          <Texto variante="subtitulo" como="h2" id={`${painelId}-titulo`}>
            Avisos de cadastro
          </Texto>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={aoFechar}
            aria-label="Fechar avisos"
            className="shrink-0 rounded-full"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </Linha>
        <Pilha espaco={2} className="min-h-0 flex-1 overflow-auto p-3">
          {estado === "erro" && (
            <Pilha espaco={2}>
              <Texto variante="alerta" role="alert">
                Não foi possível carregar os avisos.
              </Texto>
              <Button type="button" variant="outline" onClick={aoTentarDeNovo}>
                Tentar de novo
              </Button>
            </Pilha>
          )}
          {estado === "carregando" && (
            <Texto variante="apoio" role="status">
              Carregando…
            </Texto>
          )}
          {estado === "pronto" && avisos.length === 0 && (
            <Texto variante="apoio">Nenhum aviso de cadastro.</Texto>
          )}
          {avisos.map((aviso) => (
            <ItemDeAviso key={aviso.id} aviso={aviso} aoSelecionar={aoSelecionar} />
          ))}
          {temMais && (
            <Button
              type="button"
              variant="outline"
              disabled={carregandoMais}
              onClick={aoCarregarMais}
            >
              Carregar mais
            </Button>
          )}
        </Pilha>
      </Caixa>
    </>
  );
}
