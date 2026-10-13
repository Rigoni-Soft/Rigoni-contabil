import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { MensagemBalao } from "@/presentation/components/molecules/mensagem-balao.component";
import { SeletorDeEmoji } from "@/presentation/components/molecules/seletor-de-emoji.component";

type MensagemView = {
  id: string;
  lado: "contato" | "ura" | "atendente";
  autor: string;
  detalhe: string | null;
  texto: string;
  hora: string;
  reacao?: string | null;
  reagivel?: boolean;
  anexo?: {
    tipo: "imagem" | "audio" | "documento";
    nome: string;
    tamanho: string;
    url: string;
  } | null;
};

// Reação a Mensagens do cliente: estado, refs e envio vêm do Container.
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

type ListaDeMensagensProps = {
  mensagens: MensagemView[];
  reacao?: ReacaoProps;
  // Arquivo solto sobre a conversa (arrastar e soltar); sem ele a lista não aceita soltar.
  aoSoltar?: (arquivo: File) => void;
};

// Em tela larga é a única parte da página que rola. O rolador é col-reverse com a lista dentro em
// ordem cronológica: o scroll nasce no fim (nas últimas mensagens) sem JavaScript e o DOM segue a
// ordem de leitura. role="log" anuncia a mensagem nova ao leitor de tela.
export function ListaDeMensagens({ mensagens, reacao, aoSoltar }: ListaDeMensagensProps) {
  return (
    // O erro de reação fica fora do rolador (col-reverse o jogaria para o topo, fora de vista).
    <Pilha espaco="campo" className="min-h-0 lg:flex-1">
      <Linha
        role="log"
        aria-label="Conversa"
        onDragOver={aoSoltar && ((evento) => evento.preventDefault())}
        onDrop={
          aoSoltar &&
          ((evento) => {
            evento.preventDefault();
            const arquivo = evento.dataTransfer.files[0];
            if (arquivo) aoSoltar(arquivo);
          })
        }
        className="max-h-[60vh] min-h-0 flex-col-reverse overflow-y-auto rounded-xl border border-border bg-muted/50 p-3 lg:max-h-none lg:flex-1"
      >
        <Pilha espaco="campo" como="ol" aria-label="Mensagens" className="shrink-0">
          {mensagens.map(({ id, reagivel, anexo, ...mensagem }) => {
            const aberto = reacao?.abertaId === id;
            return (
              <MensagemBalao
                key={id}
                {...mensagem}
                anexo={anexo && { ...anexo, painelId: `anexo-${id}` }}
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
      </Linha>
      {reacao?.erro && <AvisoDeStatus tipo="erro" texto={reacao.erro} />}
    </Pilha>
  );
}
