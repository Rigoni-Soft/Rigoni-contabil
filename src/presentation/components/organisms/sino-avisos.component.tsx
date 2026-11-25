import { Bell } from "lucide-react";

import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  ItemDeAviso,
  type AvisoDeCadastro,
} from "@/presentation/components/molecules/item-de-aviso.component";
import { PainelModal } from "@/presentation/components/molecules/painel-modal.component";
import { Button } from "@/presentation/components/ui/button";
import { cn } from "@/presentation/lib/utils";

type SinoAvisosProps = {
  painelId: string;
  contador: number;
  anuncio: string;
  avisos: AvisoDeCadastro[];
  estado: "carregando" | "erro" | "pronto";
  temMais: boolean;
  carregandoMais: boolean;
  aoAbrir: () => void;
  aoFechar: () => void;
  aoSelecionar: (aviso: AvisoDeCadastro) => void;
  aoCarregarMais: () => void;
  aoTentarDeNovo: () => void;
};

const TETO_DO_SELO = 99;

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
      <Texto variante="somenteLeitor" como="span" role="status">
        {anuncio}
      </Texto>
      <Button
        type="button"
        variant="outline"
        onClick={aoAbrir}
        aria-label={destaque ? `Avisos de cadastro, ${contador} não vistos` : "Avisos de cadastro"}
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
      <PainelModal
        painelId={painelId}
        titulo="Avisos de cadastro"
        rotuloDoFechar="Fechar avisos"
        aoFechar={aoFechar}
      >
        <Pilha espaco={2} className="min-h-0 flex-1 overflow-auto p-3">
          {estado === "erro" && (
            <>
              <Texto variante="alerta" role="alert">
                Não foi possível carregar os avisos.
              </Texto>
              <Button type="button" variant="outline" onClick={aoTentarDeNovo}>
                Tentar de novo
              </Button>
            </>
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
      </PainelModal>
    </>
  );
}
