import { Plus, Smile } from "lucide-react";

import {
  BOTAO_DE_EMOJI,
  BotaoDeEmoji,
} from "@/presentation/components/atoms/botao-de-emoji.component";
import { Button } from "@/presentation/components/ui/button";
import { CATEGORIAS_DE_EMOJI, NOME_DO_EMOJI } from "@/presentation/lib/emojis";
import { cn } from "@/presentation/lib/utils";

type SeletorDeEmojiProps = {
  aberto: boolean;
  // Últimos escolhidos, do mais novo ao mais antigo.
  recentes: string[];
  // Com recentes, o seletor mostra só a linha deles até `completo` (via "ver todos").
  completo: boolean;
  onExpandir: () => void;
  onAlternar: (evento: React.MouseEvent<HTMLButtonElement>) => void;
  // Posição `fixed` do painel (reação em balão, fora do corte do rolador); sem ela, acima do botão.
  estilo?: React.CSSProperties;
  onEscolher: (emoji: string) => void;
  painelId: string;
  raizRef: React.Ref<HTMLDivElement>;
  botaoRef: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
  // Reação em balão: botão pequeno e rótulo próprio.
  rotulo?: string;
  compacto?: boolean;
};

export function SeletorDeEmoji({
  aberto,
  recentes,
  completo,
  onExpandir,
  estilo,
  onAlternar,
  onEscolher,
  painelId,
  raizRef,
  botaoRef,
  disabled,
  rotulo = "Inserir emoji",
  compacto = false,
}: SeletorDeEmojiProps) {
  return (
    <div ref={raizRef} className="relative">
      <Button
        ref={botaoRef}
        type="button"
        variant="ghost"
        size="icon"
        // Compacto: glifo de 28px no balão, com a área de toque ampliada a 44px.
        className={cn(
          "rounded-full",
          compacto && "relative size-7 before:absolute before:-inset-2",
        )}
        aria-label={rotulo}
        aria-expanded={aberto}
        aria-controls={aberto ? painelId : undefined}
        disabled={disabled}
        onClick={onAlternar}
      >
        <Smile aria-hidden="true" className={compacto ? "size-4" : "size-6"} />
      </Button>
      {aberto && (
        <div
          id={painelId}
          role="group"
          aria-label={compacto ? "Emojis da reação" : "Emojis"}
          style={estilo}
          className={cn(
            "z-20 max-h-64 w-72 space-y-2 overflow-y-auto rounded-xl border border-input bg-background p-2 shadow-md",
            estilo ? "fixed" : "absolute bottom-full left-0 mb-2",
          )}
        >
          {recentes.length > 0 && (
            <div role="group" aria-label="Recentes" className="flex flex-wrap items-center">
              {recentes.map((emoji) => (
                <BotaoDeEmoji
                  key={emoji}
                  emoji={emoji}
                  nome={NOME_DO_EMOJI.get(emoji) ?? emoji}
                  onEscolher={onEscolher}
                />
              ))}
              {!completo && (
                <button
                  type="button"
                  aria-label="Ver todos os emojis"
                  className={cn(BOTAO_DE_EMOJI, "ml-auto text-muted-foreground")}
                  onClick={onExpandir}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </button>
              )}
            </div>
          )}
          {(recentes.length === 0 || completo) &&
            CATEGORIAS_DE_EMOJI.map((categoria) => (
              <div key={categoria.nome} role="group" aria-label={categoria.nome}>
                <p className="px-1 text-xs text-muted-foreground">{categoria.nome}</p>
                <div className="flex flex-wrap">
                  {categoria.emojis.map(([emoji, nome]) => (
                    <BotaoDeEmoji key={emoji} emoji={emoji} nome={nome} onEscolher={onEscolher} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
