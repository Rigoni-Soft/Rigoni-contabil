import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeLink } from "@/presentation/components/atoms/botao-de-link.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { MensagemBalao } from "@/presentation/components/molecules/mensagem-balao.component";
import { SeletorDeEmoji } from "@/presentation/components/molecules/seletor-de-emoji.component";
import { SobreposicaoDeSoltar } from "@/presentation/components/molecules/sobreposicao-de-soltar.component";
import { tipoDePrevia, type FormatoDeOffice } from "@/shared/kernel/anexo";

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
  reacao?: string | null;
  reagivel?: boolean;
  aviso?: string | null;
  anexo?: {
    tipo: "imagem" | "audio" | "documento";
    nome: string;
    tamanho: string;
    url: string;
    urlVisualizacao: string;
    miniaturaUrl?: string | null;
  } | null;
};

type ReacaoProps = {
  ativa: boolean;
  abertaId: string | null;
  estilo?: React.CSSProperties;
  completo: boolean;
  recentes: string[];
  painelId: string;
  raizRef: React.Ref<HTMLDivElement>;
  botaoRef: React.Ref<HTMLButtonElement>;
  erro?: string;
  aoAlternar: (mensagemId: string, botao: DOMRect) => void;
  aoExpandir: () => void;
  aoEscolher: (mensagemId: string, emoji: string) => void;
};

type ArrasteProps = {
  arrastando: boolean;
  ligacoes?: Pick<
    React.DOMAttributes<HTMLElement>,
    "onDragEnter" | "onDragOver" | "onDragLeave" | "onDrop"
  >;
};

type AnterioresProps = {
  disponivel: boolean;
  carregando: boolean;
  erro?: string;
  aoCarregar: () => void;
};

type ListaDeMensagensProps = {
  mensagens: MensagemView[];
  anteriores?: AnterioresProps;
  previaDoAnexo?: (anexo: {
    nome: string;
    urlVisualizacao: string;
    formato: FormatoDeOffice;
    painelId: string;
  }) => React.ReactNode;
  reacao?: ReacaoProps;
  arraste?: ArrasteProps;
};

function previaDoAnexoDe(
  painelId: string,
  anexo: NonNullable<MensagemView["anexo"]>,
  previaDoAnexo: ListaDeMensagensProps["previaDoAnexo"],
) {
  const formato = tipoDePrevia(anexo.nome);
  if (anexo.tipo !== "documento" || (formato !== "docx" && formato !== "xlsx")) return undefined;
  return previaDoAnexo?.({
    nome: anexo.nome,
    urlVisualizacao: anexo.urlVisualizacao,
    formato,
    painelId,
  });
}

export function ListaDeMensagens({
  mensagens,
  anteriores,
  previaDoAnexo,
  reacao,
  arraste,
}: ListaDeMensagensProps) {
  return (
    <Pilha espaco="campo" className="relative min-h-0 lg:flex-1" {...arraste?.ligacoes}>
      {arraste?.arrastando && <SobreposicaoDeSoltar />}
      <Linha
        role="log"
        aria-label="Conversa"
        className="max-h-[60vh] min-h-0 flex-col-reverse overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 lg:max-h-none lg:flex-1"
      >
        <Pilha espaco="campo" className="shrink-0">
          {anteriores?.disponivel && (
            <BotaoDeLink onClick={anteriores.aoCarregar} disabled={anteriores.carregando}>
              {anteriores.carregando ? "Carregando…" : "Ver mensagens anteriores"}
            </BotaoDeLink>
          )}
          {anteriores?.erro && <AvisoDeStatus tipo="erro" texto={anteriores.erro} />}
          <Pilha espaco="campo" como="ol" aria-label="Mensagens">
            {mensagens.map(({ id, reagivel, anexo, ...mensagem }) => {
              const aberto = reacao?.abertaId === id;
              return (
                <MensagemBalao
                  key={id}
                  {...mensagem}
                  anexo={
                    anexo && {
                      ...anexo,
                      painelId: `anexo-${id}`,
                      previa: previaDoAnexoDe(`anexo-${id}`, anexo, previaDoAnexo),
                    }
                  }
                  acao={
                    reacao?.ativa && reagivel ? (
                      <SeletorDeEmoji
                        compacto
                        rotulo={`Reagir à mensagem de ${mensagem.autor}`}
                        aberto={aberto}
                        recentes={reacao.recentes}
                        completo={reacao.completo}
                        onExpandir={reacao.aoExpandir}
                        estilo={aberto ? reacao.estilo : undefined}
                        painelId={reacao.painelId}
                        raizRef={aberto ? reacao.raizRef : null}
                        botaoRef={aberto ? reacao.botaoRef : null}
                        onAlternar={(evento) =>
                          reacao.aoAlternar(id, evento.currentTarget.getBoundingClientRect())
                        }
                        onEscolher={(emoji) => reacao.aoEscolher(id, emoji)}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </Pilha>
        </Pilha>
      </Linha>
      {reacao?.erro && <AvisoDeStatus tipo="erro" texto={reacao.erro} />}
    </Pilha>
  );
}
