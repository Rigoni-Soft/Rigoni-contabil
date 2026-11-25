import { Plus, Smile } from "lucide-react";

import { BotaoDeEmoji } from "@/presentation/components/atoms/botao-de-emoji.component";
import { Caixa, Linha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { CATEGORIAS_DE_EMOJI, NOME_DO_EMOJI } from "@/presentation/lib/emojis";
import { cn } from "@/presentation/lib/utils";

type SeletorDeEmojiProps = {
  aberto: boolean;
  recentes: string[];
  completo: boolean;
  onExpandir: () => void;
  onAlternar: (evento: React.MouseEvent<HTMLButtonElement>) => void;
  estilo?: React.CSSProperties;
  onEscolher: (emoji: string) => void;
  painelId: string;
  raizRef: React.Ref<HTMLDivElement>;
  botaoRef: React.Ref<HTMLButtonElement>;
  disabled?: boolean;
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
    <Caixa ref={raizRef} className="relative">
      <Button
        ref={botaoRef}
        type="button"
        variant="ghost"
        size="icon"
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
        <Caixa
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
            <Linha alinhar="centro" quebra role="group" aria-label="Recentes">
              {recentes.map((emoji) => (
                <BotaoDeEmoji
                  key={emoji}
                  emoji={emoji}
                  nome={NOME_DO_EMOJI.get(emoji) ?? emoji}
                  onEscolher={onEscolher}
                />
              ))}
              {!completo && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Ver todos os emojis"
                  className="ml-auto text-muted-foreground"
                  onClick={onExpandir}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </Button>
              )}
            </Linha>
          )}
          {(recentes.length === 0 || completo) &&
            CATEGORIAS_DE_EMOJI.map((categoria) => (
              <Caixa key={categoria.nome} role="group" aria-label={categoria.nome}>
                <Texto variante="nota" className="px-1">
                  {categoria.nome}
                </Texto>
                <Linha quebra>
                  {categoria.emojis.map(([emoji, nome]) => (
                    <BotaoDeEmoji key={emoji} emoji={emoji} nome={nome} onEscolher={onEscolher} />
                  ))}
                </Linha>
              </Caixa>
            ))}
        </Caixa>
      )}
    </Caixa>
  );
}
