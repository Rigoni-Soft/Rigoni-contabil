import { redirect } from "next/navigation";

import { CampoResponsavel } from "@/presentation/components/molecules/campo-responsavel.component";
import { FalhaDeCarga } from "@/presentation/components/molecules/falha-de-carga.component";
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
import { servicosDoCliente } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.presenter";
import { carregarAcompanhamentoMensal } from "@/modules/rh/presentation/view-models/acompanhamento-mensal/acompanhamento-mensal.server";
import { hrefSeguro } from "@/shared/kernel/href-seguro";
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
  searchParams: Promise<{ voltarPara?: string; alteracao?: string | string[] }>;
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
    responsavelRh?: React.ReactNode;
    acompanhamentoRh?: React.ReactNode;
  },
) {
  if (rh?.ok && rh.value) {
    return (
      <EditarCadastroRhContainer
        dados={rh.value}
        ator={{ papel: sessao.papel, setor: sessao.setor }}
        readOnly={opcoes.readOnly}
        voltarHref={hrefSeguro(opcoes.voltarPara)}
        documentosContratuais={documentos?.ok ? documentos.value : undefined}
        responsavel={opcoes.responsavelRh}
        acompanhamento={opcoes.acompanhamentoRh}
      />
    );
  }
  if (!operacional?.ok || !operacional.value) return undefined;
  return (
    <EditarCadastroOperacionalContainer
      dados={operacional.value}
      ator={{ papel: sessao.papel, setor: sessao.setor }}
      readOnly={opcoes.readOnly}
      documentosContratuais={documentos?.ok ? documentos.value : undefined}
      podeAnexar={podeAnexarAlteracaoContratual(sessao.papel)}
      alteracaoEmFoco={alteracaoEmFocoDaUrl(opcoes.alteracao)}
      podeAtribuirResponsavel={
        opcoes.atribuiNoCadastro && podeAtribuirResponsavel(sessao.papel, sessao.setor)
      }
      aoSalvar={{ tipo: "voltar", href: hrefSeguro(opcoes.voltarPara) }}
    />
  );
}

async function acompanhamentoRhDoCliente(
  clienteId: string,
  sessao: { papel: string; setor: string },
) {
  if (!podeVerAcompanhamentoRh(sessao.papel, sessao.setor)) return undefined;
  const acompanhamento = await carregarAcompanhamentoMensal(undefined);
  if (!acompanhamento.ok) return undefined;
  const { servicos, aviso } = servicosDoCliente(acompanhamento.value, clienteId);

  return (
    <AcompanhamentoDoClienteContainer
      clienteId={clienteId}
      competencia={acompanhamento.value.competencia}
      servicos={servicos}
      aviso={aviso}
    />
  );
}

function tituloDaPagina(readOnly: boolean) {
  return readOnly ? "Visualizar cadastro operacional" : "Editar cadastro operacional";
}

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;
  const { voltarPara, alteracao } = await searchParams;
  const sessao = validarSessao(await carregarSessao());
  const cadastroRhDoAdmin =
    sessao.papel === "admin" ? carregarCadastroRhCliente(id) : Promise.resolve(null);
  const cadastroDoRh = usaCadastroDoRh(sessao.papel, sessao.setor);
  const carga = await carregarClienteParaPagina(id, sessao.papel, sessao.setor);
  const { rh, operacional, documentos } = carga;
  const carregado = rh ?? operacional;
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

  const { noCadastro: atribuiNoCadastro, noSetor: atribuiNoSetor } = ondeAtribuirResponsavel(
    sessao.papel,
    sessao.setor,
  );
  const responsavelDoSetor = atribuiNoSetor ? await carregarResponsavelDoSetor(id) : null;
  const readOnly = cadastroDoRh
    ? !podeEditarCadastroRh(sessao.papel, sessao.setor)
    : !podeEditarCadastroOperacional(sessao.papel, sessao.setor);
  const acompanhamentoRh = await acompanhamentoRhDoCliente(id, sessao);
  const observacoesRhDoAdmin = await cadastroRhDoAdmin;

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
    : (campoResponsavel ?? <CampoResponsavel editavel={false} nomeAtual={sessao.nome} />);

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
      acompanhamentoRh={cadastroDoRh ? undefined : acompanhamentoRh}
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
