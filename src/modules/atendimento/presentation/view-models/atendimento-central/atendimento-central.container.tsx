"use client";

import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ListaDeAtendimento } from "@/presentation/components/organisms/lista-de-atendimento.component";
import { AtendimentoTemplate } from "@/presentation/components/templates/atendimento-template.component";
import type { ItemDaFilaVisto } from "@/modules/atendimento/application/ports/in/listar-fila.provider";
import type { AtendimentoVisto } from "@/modules/atendimento/application/ports/in/listar-meus-atendimentos.provider";
import type { ConversaVista } from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import { useAtendimentoCentral } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-atendimento-central.hook";
import { useConversaAberta } from "@/modules/atendimento/presentation/view-models/atendimento-central/use-conversa-aberta.hook";
import { AcoesConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/acoes-conversa.container";
import { CabecalhoConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/cabecalho-conversa.container";
import { CompositorConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/compositor-conversa.container";
import { MensagensConversaContainer } from "@/modules/atendimento/presentation/view-models/conversa/mensagens-conversa.container";
import { SETOR_LABEL, SETORES, type SetorSlug } from "@/shared/kernel/setores";

type AtendimentoCentralContainerProps = {
  // Cabeçalho e navegação vêm montados da page (Server) e só passam por aqui.
  header: React.ReactNode;
  nav: React.ReactNode;
  usuarioId: string;
  setorInicial: SetorSlug;
  filaInicial: ItemDaFilaVisto[];
  meusInicial: AtendimentoVisto[];
  podeEscolherSetor: boolean;
};

const OPCOES = SETORES.map((valor) => ({ valor, rotulo: SETOR_LABEL[valor] }));

export function AtendimentoCentralContainer({
  header,
  nav,
  usuarioId,
  setorInicial,
  filaInicial,
  meusInicial,
  podeEscolherSetor,
}: AtendimentoCentralContainerProps) {
  const central = useAtendimentoCentral({
    usuarioId,
    setorInicial,
    filaInicial,
    meusInicial,
    podeEscolherSetor,
  });
  const aberta = useConversaAberta(central.abertoId);
  const id = central.abertoId;
  const conversa = aberta.data;

  return (
    <AtendimentoTemplate
      header={header}
      nav={nav}
      lista={
        <ListaDeAtendimento
          aba={central.aba}
          onEscolherAba={central.escolherAba}
          espera={central.espera}
          emAtendimento={central.emAtendimento}
          abertoId={id}
          onAbrir={central.abrir}
          onAssumir={central.assumir}
          assumindo={central.assumindo}
          aviso={central.avisoDeAssuncao}
          carregando={central.carregando}
          indisponivel={central.indisponivel}
          escolhaDeSetor={
            podeEscolherSetor
              ? { setor: central.setor, opcoes: OPCOES, onChange: central.escolherSetor }
              : undefined
          }
        />
      }
      voltar={<VoltarParaLista onClick={central.fecharConversa} />}
      chat={
        id === null ? undefined : conversa ? (
          // `key`: trocar de conversa recomeça o estado local (rascunho, emoji, gravação).
          <ChatCentral key={id} id={id} conversa={conversa} />
        ) : aberta.isError ? (
          <Texto variante="alerta" role="alert">
            Não foi possível abrir a conversa.
          </Texto>
        ) : (
          <Texto variante="apoio" role="status">
            Abrindo a conversa…
          </Texto>
        )
      }
      acoes={
        id !== null && conversa && !conversa.encerrado ? (
          <AcoesConversaContainer
            key={id}
            atendimentoId={id}
            initialData={conversa}
            aoSair={central.fecharConversa}
          />
        ) : undefined
      }
    />
  );
}

function ChatCentral({ id, conversa }: { id: string; conversa: ConversaVista }) {
  return (
    <>
      <CabecalhoConversaContainer atendimentoId={id} initialData={conversa} />
      <MensagensConversaContainer atendimentoId={id} initialData={conversa} />
      <CompositorConversaContainer atendimentoId={id} initialData={conversa} />
    </>
  );
}

// Em tela estreita o chat ocupa o lugar da lista: este botão devolve a lista.
function VoltarParaLista({ onClick }: { onClick: () => void }) {
  return (
    <Caixa
      como="button"
      type="button"
      onClick={onClick}
      className="inline-flex min-h-6 items-center text-sm text-muted-foreground hover:text-foreground hover:underline pointer-coarse:min-h-11"
    >
      ← Voltar à lista
    </Caixa>
  );
}
