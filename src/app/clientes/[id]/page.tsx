import { redirect } from "next/navigation";

import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";
import { ResponsavelSomenteLeitura } from "@/presentation/components/molecules/responsavel-somente-leitura.component";
import { EditarCadastroOperacionalPage } from "@/presentation/components/pages/editar-cadastro-operacional.page";
import { carregarSessao, validarSessao } from "@/presentation/view-models/shell/shell.server";
import { AnexarAlteracaoContratualContainer } from "@/modules/clientes/presentation/view-models/anexar-alteracao-contratual/anexar-alteracao-contratual.container";
import { CabecalhoDoShellContainer } from "@/modules/clientes/presentation/view-models/avisos-cadastro/cabecalho-do-shell.container";
import { EditarCadastroOperacionalContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.container";
import {
  carregarCadastroRhCliente,
  carregarClienteParaPagina,
} from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.server";
import { EditarCadastroRhContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-rh/editar-cadastro-rh.container";
import { ObservacoesDoRhContainer } from "@/modules/clientes/presentation/view-models/editar-cadastro-rh/observacoes-do-rh.container";
import { ResponsavelDoSetorContainer } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.container";
import { ondeAtribuirResponsavel } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.presenter";
import { carregarResponsavelDoSetor } from "@/modules/clientes/presentation/view-models/responsavel-do-setor/responsavel-do-setor.server";
import { alteracaoEmFocoDaUrl } from "@/modules/clientes/presentation/view-models/visualizar-documento-contratual/documentos-contratuais.presenter";
import { AcompanhamentoDoClienteContainer } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-do-cliente.container";
import {
  linksDoMes,
  rotuloDaCompetencia,
  servicosDoCliente,
} from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { hrefSeguro } from "@/shared/kernel/href-seguro";
import { mesAtual } from "@/shared/kernel/mes-atual";
import {
  podeAnexarAlteracaoContratual,
  podeAtribuirResponsavel,
  podeEditarCadastroOperacional,
  podeEditarCadastroRh,
  podeVerAcompanhamentoRh,
  usaCadastroDoRh,
} from "@/shared/kernel/papeis";
import { ehSetor, SETOR_LABEL } from "@/shared/kernel/setores";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[]; mes?: string }>;
};

type CargaDoCliente = Awaited<ReturnType<typeof carregarClienteParaPagina>>;

function montarFormulario(
  { rh, operacional, documentos }: CargaDoCliente,
  sessao: { papel: string; setor: string },
  opcoes: {
    readOnly: boolean;
    atribuiNoCadastro: boolean;
    voltarPara?: string;
    alteracao?: string | string[];
    // Só o cadastro do RH: o Responsável e o acompanhamento entram no mesmo cartão do formulário.
    responsavelRh?: React.ReactNode;
    acompanhamentoRh?: { mes: React.ReactNode; corpo: React.ReactNode };
  },
) {
  if (rh?.ok && rh.value) {
    return (
      <EditarCadastroRhContainer
        dados={rh.value}
        readOnly={opcoes.readOnly}
        voltarHref={hrefSeguro(opcoes.voltarPara)}
        documentosContratuais={documentos?.ok ? documentos.value : undefined}
        responsavel={opcoes.responsavelRh}
        mesDoAcompanhamento={opcoes.acompanhamentoRh?.mes}
        acompanhamento={opcoes.acompanhamentoRh?.corpo}
      />
    );
  }
  if (!operacional?.ok || !operacional.value) return undefined;
  return (
    <EditarCadastroOperacionalContainer
      dados={operacional.value}
      readOnly={opcoes.readOnly}
      // Se a carga do servidor falhar, o botão se lê por action (com aviso e "Tentar novamente").
      documentosContratuais={documentos?.ok ? documentos.value : undefined}
      podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
      // Vindo de aviso de alteração: o botão do documento abre aquela alteração, em destaque.
      alteracaoEmFoco={alteracaoEmFocoDaUrl(opcoes.alteracao)}
      podeAtribuirResponsavel={
        opcoes.atribuiNoCadastro && podeAtribuirResponsavel(sessao.papel, sessao.setor)
      }
      aoSalvar={{ tipo: "voltar", href: hrefSeguro(opcoes.voltarPara) }}
    />
  );
}

// O acompanhamento do mês do RH, no painel do Cliente (como o DAS no do SN). Some quando o mês é inválido
// ou o ator não vê o RH; sem Responsável, os serviços vêm bloqueados; o resto da tela não depende dele.
// ponytail: lê a carteira do RH inteira para achar este Cliente; filtrar por cliente no repositório se pesar.
async function acompanhamentoRhDoCliente(
  clienteId: string,
  sessao: { papel: string; setor: string },
  mes: string | undefined,
  voltarPara: string | undefined,
) {
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) return undefined;
  const acompanhamento = await carregarAcompanhamentoMensal(mes);
  if (!acompanhamento.ok) return undefined;
  const { servicos, aviso } = servicosDoCliente(acompanhamento.value, clienteId);

  const { competencia } = acompanhamento.value;
  // O mês (só links) e a lista (com estado) são dois nós: o mês entra no topo do cartão, na ordem do foco.
  return {
    mes: (
      <NavegacaoDeMes
        rotuloMes={rotuloDaCompetencia(competencia)}
        {...linksDoMes(clienteId, competencia, mesAtual(), voltarPara)}
        destaque
        className="mb-3"
      />
    ),
    corpo: (
      <AcompanhamentoDoClienteContainer
        clienteId={clienteId}
        competencia={competencia}
        servicos={servicos}
        aviso={aviso}
      />
    ),
  };
}

function tituloDaPagina(readOnly: boolean) {
  return readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao, mes } = await searchParams;
  const sessao = validarSessao(await carregarSessao());
  // O Admin vê o SN e o RH: na tela completa, as observações do RH entram à parte (lidas em paralelo).
  const cadastroRhDoAdmin =
    sessao.papel === "admin" ? carregarCadastroRhCliente(id) : Promise.resolve(null);
  const cadastroDoRh = usaCadastroDoRh(sessao.papel, sessao.setor);
  const carga = await carregarClienteParaPagina(id, sessao.papel, sessao.setor);
  const { rh, operacional, documentos } = carga;
  const carregado = rh ?? operacional;
  // Falha de leitura não é Cliente inexistente: só este segundo volta ao início.
  if (carregado && !carregado.ok) {
    return (
      <EditarCadastroOperacionalPage
        header={<CabecalhoDoShellContainer sessao={sessao} />}
        titulo="Não foi possível carregar o cliente"
        voltarHref={hrefSeguro(voltarPara)}
        formulario={
          <FalhaDeCarga
            texto="Houve um erro ao ler os dados. Tente novamente."
            tentarNovamenteHref={`/clientes/${encodeURIComponent(id)}${
              voltarPara ? `?voltarPara=${encodeURIComponent(voltarPara)}` : ""
            }`}
          />
        }
      />
    );
  }
  if (!carregado?.value) redirect("/");

  // Só Admin ou Funcionário do setor Simples Nacional edita — qualquer outro
  // perfil autenticado só visualiza.
  // O SN atribui no próprio cadastro; o Líder dos demais Setores, no bloco do Setor dele.
  const { noCadastro: atribuiNoCadastro, noSetor: atribuiNoSetor } = ondeAtribuirResponsavel(
    sessao.papel,
    sessao.setor,
  );
  const responsavelDoSetor = atribuiNoSetor ? await carregarResponsavelDoSetor(id) : null;
  const readOnly = cadastroDoRh
    ? !podeEditarCadastroRh(sessao.papel, sessao.setor)
    : !podeEditarCadastroOperacional(sessao.papel, sessao.setor);
  const acompanhamentoRh = await acompanhamentoRhDoCliente(id, sessao, mes, voltarPara);
  const observacoesRhDoAdmin = await cadastroRhDoAdmin;

  // No RH o Responsável e o acompanhamento ficam dentro do cartão do formulário, como o Responsável do SN;
  // o Líder o atribui ali, e quem é o Responsável o vê (só leitura).
  const campoResponsavel =
    atribuiNoSetor && ehSetor(sessao.setor) && responsavelDoSetor?.ok ? (
      <ResponsavelDoSetorContainer
        clienteId={id}
        setorRotulo={SETOR_LABEL[sessao.setor]}
        atual={responsavelDoSetor.value}
        embutido={cadastroDoRh}
      />
    ) : undefined;
  const responsavelRh = !cadastroDoRh
    ? undefined
    : (campoResponsavel ?? <ResponsavelSomenteLeitura nome={sessao.nome} />);

  const formulario = montarFormulario(carga, sessao, {
    readOnly,
    atribuiNoCadastro,
    voltarPara,
    alteracao,
    responsavelRh,
    acompanhamentoRh,
  });

  return (
    <EditarCadastroOperacionalPage
      header={<CabecalhoDoShellContainer sessao={sessao} />}
      titulo={tituloDaPagina(readOnly)}
      voltarHref={hrefSeguro(voltarPara)}
      alteracoesContratuais={
        podeAnexarAlteracaoContratual(sessao.papel) ? (
          <AnexarAlteracaoContratualContainer
            clienteId={id}
            documentosIniciais={documentos?.ok ? documentos.value : undefined}
          />
        ) : undefined
      }
      responsavelDoSetor={cadastroDoRh ? undefined : campoResponsavel}
      acompanhamentoRh={
        cadastroDoRh || !acompanhamentoRh ? undefined : (
          <>
            {acompanhamentoRh.mes}
            {acompanhamentoRh.corpo}
          </>
        )
      }
      observacoesRh={
        observacoesRhDoAdmin?.ok && observacoesRhDoAdmin.value ? (
          <ObservacoesDoRhContainer
            clienteId={id}
            observacoesIniciais={observacoesRhDoAdmin.value.observacoes}
          />
        ) : undefined
      }
      formulario={formulario}
    />
  );
}
