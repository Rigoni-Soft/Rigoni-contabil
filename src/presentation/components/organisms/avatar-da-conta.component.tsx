import { Loader2 } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeArquivo } from "@/presentation/components/atoms/botao-de-arquivo.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Miniatura } from "@/presentation/components/atoms/miniatura.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

type AvatarDaContaProps = {
  // A imagem de hoje: a foto guardada ou a logo.
  srcAtual: string;
  temFoto: boolean;
  // Foto escolhida, já recortada, ainda não salva.
  previaSrc?: string;
  pendente: boolean;
  erro?: string;
  idDoEscolher: string;
  aceitar: string;
  aoEscolher: (arquivo: File) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
  aoRemover: () => void;
};

// Meu perfil: o Funcionário envia, troca e remove a foto do avatar. O texto de transparência fica
// sempre à vista (ADR 0012), sem checkbox de consentimento.
export function AvatarDaConta({
  srcAtual,
  temFoto,
  previaSrc,
  pendente,
  erro,
  idDoEscolher,
  aceitar,
  aoEscolher,
  aoSalvar,
  aoCancelar,
  aoRemover,
}: AvatarDaContaProps) {
  return (
    <Caixa
      como="section"
      aria-labelledby="avatar-titulo"
      className="mb-8 border-t border-border pt-8"
    >
      <Texto variante="subtitulo" como="h2" id="avatar-titulo" className="mb-2">
        Sua foto
      </Texto>
      <Texto variante="apoio" className="mb-6">
        Sua foto fica guardada no sistema e só você a vê. Remova quando quiser.
      </Texto>
      <Linha alinhar="centro" espaco={4} quebra>
        <Miniatura
          src={previaSrc ?? srcAtual}
          className="size-20 rounded-full border border-input"
        />
        <Pilha espaco={2}>
          {previaSrc ? (
            <Linha espaco={2} quebra>
              <Button
                type="button"
                size="sm"
                autoFocus
                aria-disabled={pendente || undefined}
                onClick={pendente ? undefined : aoSalvar}
              >
                {pendente && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
                {pendente ? "Salvando…" : "Salvar foto"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-disabled={pendente || undefined}
                onClick={pendente ? undefined : aoCancelar}
              >
                Cancelar
              </Button>
            </Linha>
          ) : (
            <Linha espaco={2} quebra alinhar="centro">
              <BotaoDeArquivo
                id={idDoEscolher}
                rotulo={temFoto ? "Trocar foto" : "Escolher foto"}
                rotuloAcessivel={temFoto ? "Trocar foto" : "Escolher foto"}
                aceitar={aceitar}
                ocupado={pendente}
                onEscolher={aoEscolher}
              />
              {temFoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-disabled={pendente || undefined}
                  onClick={pendente ? undefined : aoRemover}
                >
                  Remover foto
                </Button>
              )}
            </Linha>
          )}
          <Texto variante="apoio">JPEG, PNG ou WebP, até 5 MB.</Texto>
        </Pilha>
      </Linha>
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} className="mt-3" />}
    </Caixa>
  );
}
