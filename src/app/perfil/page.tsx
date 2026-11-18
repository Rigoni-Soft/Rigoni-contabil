import { PerfilPage } from "@/presentation/components/pages/perfil.page";
import { exigirSessao } from "@/presentation/view-models/shell/shell.server";
import { VoltarAoHistoricoContainer } from "@/presentation/view-models/shell/voltar-ao-historico.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { AvatarDaContaContainer } from "@/modules/usuarios/presentation/view-models/avatar/avatar-da-conta.container";
import { TrocarSenhaContainer } from "@/modules/usuarios/presentation/view-models/trocar-senha/trocar-senha.container";

export default async function Page() {
  // Senha provisória: o fluxo obrigatório tem prioridade sobre o perfil.
  const sessao = await exigirSessao();

  return (
    <PerfilPage
      nome={sessao.nome}
      email={sessao.email}
      papel={sessao.papel}
      setor={sessao.setor}
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      voltar={<VoltarAoHistoricoContainer />}
      avatar={
        sessao.podePersonalizarAvatar && (
          <AvatarDaContaContainer
            papel={sessao.papel}
            setor={sessao.setor}
            avatarAtualizadoEm={sessao.avatarAtualizadoEm}
          />
        )
      }
      formulario={<TrocarSenhaContainer />}
    />
  );
}
