import { redirect } from "next/navigation";

import { DadosBasicosDoCliente } from "@/presentation/components/organisms/dados-basicos-do-cliente.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { AnexarAlteracaoContratualContainer } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import { carregarCadastroOperacionalCliente } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { ResponsavelDoSetorContainer } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.container";
import { ondeAtribuirResponsavel } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.presenter";
import { carregarResponsavelDoSetor } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.server";
import { alteracaoEmFocoDaUrl } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/documentos-contratuais.presenter";
import { carregarDocumentosContratuais } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/visualizar-documento-contratual.server";
import { hrefSeguro } from "@/shared/kernel/href-seguro";
import {
  podeAnexarAlteracaoContratual,
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
} from "@/shared/kernel/papeis";
import { REGIME_LABEL } from "@/shared/kernel/regimes";
import { ehSetor, SETOR_LABEL } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[] }>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao } = await searchParams;
  const [sessaoOuNula, resultado, documentos] = await Promise.all([
    carregarSessao(),
    carregarCadastroOperacionalCliente(id),
    carregarDocumentosContratuais(id),
  ]);
  const sessao = validarSessao(sessaoOuNula);
  if (!resultado.ok || !resultado.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
  // O SN atribui no próprio cadastro; o Líder dos demais Setores, no bloco do Setor dele.
  const { noCadastro: atribuiNoCadastro, noSetor: atribuiNoSetor } = ondeAtribuirResponsavel(
    sessao.papel,
    sessao.setor,
  );
  const responsavelDoSetor = atribuiNoSetor ? await carregarResponsavelDoSetor(id) : null;
  const readOnly = !podeEditarCadastroOperacional(sessao.papel, sessao.setor);
  // O RH acha qualquer Cliente, mas só lê os dados básicos: o cadastro operacional é do SN.
  const soDadosBasicos = sessao.papel !== "admin" && sessao.setor === "rh";

  return (
    <EditarCadastroOperacionalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={
        soDadosBasicos
          ? "Dados do cliente"
          : readOnly
            ? "Visualizar cadastro operacional"
            : "Editar cadastro operacional"
      }
      voltarHref={hrefSeguro(voltarPara)}
      alteracoesContratuais={
        podeAnexarAlteracaoContratual(sessao.papel) ? (
          <AnexarAlteracaoContratualContainer
            clienteId={id}
            documentosIniciais={documentos.ok ? documentos.value : undefined}
          />
        ) : undefined
      }
      responsavelDoSetor={
        atribuiNoSetor && ehSetor(sessao.setor) && responsavelDoSetor?.ok ? (
          <ResponsavelDoSetorContainer
            clienteId={id}
            setorRotulo={SETOR_LABEL[sessao.setor]}
            atual={responsavelDoSetor.value}
          />
        ) : undefined
      }
      formulario={
        soDadosBasicos ? (
          <DadosBasicosDoCliente
            empresa={resultado.value.empresa}
            cnpj={resultado.value.cnpj}
            regime={REGIME_LABEL[resultado.value.regime] ?? resultado.value.regime}
          />
        ) : (
          <EditarCadastroOperacionalContainer
            dados={resultado.value}
            readOnly={readOnly}
            // Se a carga do servidor falhar, o botão se lê por action (com aviso e "Tentar novamente").
            documentosContratuais={documentos.ok ? documentos.value : undefined}
            podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
            // Vindo de aviso de alteração: o botão do documento abre aquela alteração, em destaque.
            alteracaoEmFoco={alteracaoEmFocoDaUrl(alteracao)}
            podeAtribuirResponsavel={
              atribuiNoCadastro && podeAtribuirResponsavel(sessao.papel, sessao.setor)
            }
            aoSalvar={{ tipo: "voltar", href: hrefSeguro(voltarPara) }}
          />
        )
      }
    />
  );
}
