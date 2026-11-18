import { Loader2 } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeArquivo } from "@/presentation/components/atoms/botao-de-arquivo.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Miniatura } from "@/presentation/components/atoms/miniatura.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";

const ID_DA_DICA = "avatar-dica";
const ID_DO_ERRO = "avatar-erro";

// O que está em andamento: o rótulo do botão correspondente mostra o progresso e os demais ficam inativos.
export type AcaoDoAvatar = "preparando" | "salvando" | "removendo";

type AvatarDaContaProps = {
  // A imagem de hoje: a foto guardada ou a logo.
  srcAtual: string;
  temFoto: boolean;
  // Foto escolhida, já recortada, ainda não salva.
  previaSrc?: string;
  acao?: AcaoDoAvatar;
  erro?: string;
  idDoEscolher: string;
  aceitar: string;
  aoEscolher: (arquivo: File) => void;
  aoSalvar: () => void;
  aoCancelar: () => void;
  aoRemover: () => void;
};

const INATIVO = "aria-disabled:opacity-50";

function RotuloDeAcao({
  emCurso,
  texto,
  andamento,
}: {
  emCurso: boolean;
  texto: string;
  andamento: string;
}) {
  return (
    <>
      {emCurso && <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />}
      {emCurso ? andamento : texto}
    </>
  );
}

// Meu perfil: cada usuário, de qualquer Papel, envia, troca e remove a foto do avatar. O texto de transparência fica
// sempre à vista (ADR 0012), sem checkbox de consentimento.
export function AvatarDaConta({
  srcAtual,
  temFoto,
  previaSrc,
  acao,
  erro,
  idDoEscolher,
  aceitar,
  aoEscolher,
  aoSalvar,
  aoCancelar,
  aoRemover,
}: AvatarDaContaProps) {
  const pendente = acao !== undefined;
  const rotuloDoEscolher = temFoto ? "Trocar foto" : "Escolher foto";
  return (
    <Caixa como="section" aria-labelledby="avatar-titulo" className="mb-8">
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
                className={INATIVO}
                aria-disabled={pendente || undefined}
                onClick={pendente ? undefined : aoSalvar}
              >
                <RotuloDeAcao
                  emCurso={acao === "salvando"}
                  texto="Salvar foto"
                  andamento="Salvando…"
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={INATIVO}
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
                rotulo={acao === "preparando" ? "Preparando…" : rotuloDoEscolher}
                rotuloAcessivel={acao === "preparando" ? "Preparando a foto" : rotuloDoEscolher}
                aceitar={aceitar}
                ocupado={pendente}
                descritoPor={erro ? `${ID_DA_DICA} ${ID_DO_ERRO}` : ID_DA_DICA}
                invalido={!!erro}
                onEscolher={aoEscolher}
              />
              {temFoto && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={INATIVO}
                  aria-disabled={pendente || undefined}
                  onClick={pendente ? undefined : aoRemover}
                >
                  <RotuloDeAcao
                    emCurso={acao === "removendo"}
                    texto="Remover foto"
                    andamento="Removendo…"
                  />
                </Button>
              )}
            </Linha>
          )}
          <Texto variante="apoio" id={ID_DA_DICA}>
            JPEG, PNG ou WebP, até 5 MB.
          </Texto>
        </Pilha>
      </Linha>
      {erro && <AvisoDeStatus id={ID_DO_ERRO} tipo="erro" legivel texto={erro} className="mt-3" />}
    </Caixa>
  );
}
