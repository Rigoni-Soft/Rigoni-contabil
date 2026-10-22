import { redirect } from "next/navigation";

import { ShellHeader } from "@/presentation/components/organisms/shell-header.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { LogoutButtonContainer } from "@/presentation/view-models/shell/logout-button.container";
import { carregarSessao } from "@/presentation/view-models/shell/shell.server";
import { AnexarAlteracaoContratualContainer } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.container";
import { SinoAvisosContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/sino-avisos.container";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { carregarCadastroOperacionalCliente } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { alteracaoEmFocoDaUrl } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/documentos-contratuais.presenter";
import { carregarDocumentosContratuais } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/visualizar-documento-contratual.server";
import {
  podeAnexarAlteracaoContratual,
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
} from "@/shared/kernel/papeis";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[] }>;
};

// Só aceita caminho relativo do próprio site — nunca repassar o parâmetro de
// query direto pro href (open redirect: "//evil.com", "https://evil.com" etc.).
function voltarHrefSeguro(valor: string | undefined): string {
  if (valor && valor.startsWith("/") && !valor.startsWith("//") && !valor.includes("://")) {
    return valor;
  }
  return "/";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao } = await searchParams;
  const [sessao, resultado, documentos] = await Promise.all([
    carregarSessao(),
    carregarCadastroOperacionalCliente(id),
    carregarDocumentosContratuais(id),
  ]);
  if (!sessao) redirect("/login");
  if (sessao.precisaTrocarSenha) redirect("/trocar-senha");
  if (!resultado.ok || !resultado.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
  const readOnly = !podeEditarCadastroOperacional(sessao.papel, sessao.setor);

  return (
    <EditarCadastroOperacionalPage
      header={
        <ShellHeader
          nome={sessao.nome}
          papel={sessao.papel}
          setor={sessao.setor}
          sair={<LogoutButtonContainer />}
          avisos={<SinoAvisosContainer />}
        />
      }
      titulo={readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional"}
      voltarHref={voltarHrefSeguro(voltarPara)}
      alteracoesContratuais={
        podeAnexarAlteracaoContratual(sessao.papel) ? (
          <AnexarAlteracaoContratualContainer
            clienteId={id}
            documentosIniciais={documentos.ok ? documentos.value : undefined}
          />
        ) : undefined
      }
      formulario={
        <EditarCadastroOperacionalContainer
          dados={resultado.value}
          readOnly={readOnly}
          // Se a carga do servidor falhar, o botão se lê por action (com aviso e "Tentar novamente").
          documentosContratuais={documentos.ok ? documentos.value : undefined}
          podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
          // Vindo de aviso de alteração: o botão do documento abre aquela alteração, em destaque.
          alteracaoEmFoco={alteracaoEmFocoDaUrl(alteracao)}
          podeAtribuirResponsavel={podeAtribuirResponsavel(sessao.papel, sessao.setor)}
          voltarHrefAoSalvar={voltarHrefSeguro(voltarPara)}
        />
      }
    />
  );
}
