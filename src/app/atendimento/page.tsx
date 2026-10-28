import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { ShellNav } from "@/presentation/components/organisms/shell-nav.component";
import { AtendimentoTemplate } from "@/presentation/components/templates/atendimento-template.component";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import {
  carregarSessao,
  carregarSetoresDaNavegacao,
} from "@/presentation/view-models/shell/shell.server";
import { AcoesCentralContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/acoes-central.container";
import { ChatCentralContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/chat-central.container";
import { ListaAtendimentoContainer } from "@/modules/atendimento/presentation/view-models/atendimento-central/lista-atendimento.container";
import { carregarFila } from "@/modules/atendimento/presentation/view-models/fila/fila.server";
import { carregarMeusAtendimentos } from "@/modules/atendimento/presentation/view-models/meus-atendimentos/meus-atendimentos.server";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { ROTA_ATENDIMENTO } from "@/shared/kernel/rotas";
import { ehSetor, SETORES } from "@/shared/kernel/setores";

export default async function Page() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");

  // Admin não pertence a um Setor: começa pelo primeiro e escolhe na tela.
  const ehAdmin = sessao.papel === "admin";
  const setor = ehAdmin ? SETORES[0] : sessao.setor;
  if (!ehSetor(setor)) redirect("/");

  const [setores, fila, meus] = await Promise.all([
    carregarSetoresDaNavegacao(),
    carregarFila(setor),
    carregarMeusAtendimentos(),
  ]);

  return (
    <AtendimentoTemplate
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer usuarioId={sessao.id} />}
        />
      }
      nav={<ShellNav setores={setores} rotaAtual={ROTA_ATENDIMENTO} />}
      // Falha na carga inicial não expulsa da tela: a lista começa vazia e o polling a recupera
      // (ou avisa que está indisponível).
      lista={
        <ListaAtendimentoContainer
          usuarioId={sessao.id}
          setorInicial={setor}
          filaInicial={fila.ok ? fila.value : []}
          meusInicial={meus.ok ? meus.value : []}
          podeEscolherSetor={ehAdmin}
        />
      }
      chat={<ChatCentralContainer />}
      acoes={<AcoesCentralContainer />}
    />
  );
}
