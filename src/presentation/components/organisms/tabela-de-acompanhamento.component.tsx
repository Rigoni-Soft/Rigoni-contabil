import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Select } from "@/presentation/components/ui/select";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Servico = { id: string; nome: string };
export type EstadoDaCelula = "pendente" | "concluido" | "nao_aplica";
type Celula = { servicoId: string; estado: EstadoDaCelula; editavel: boolean };
type LinhaDoCliente = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  celulas: Celula[];
  pendentes: number;
};

type TabelaDeAcompanhamentoProps = {
  rotuloCompetencia: string;
  anteriorHref: string;
  // Sem próximo no mês corrente.
  proximoHref?: string;
  servicos: Servico[];
  linhas: LinhaDoCliente[];
  pendente: boolean;
  erro?: string;
  onTrocar: (clienteId: string, servicoId: string, de: EstadoDaCelula, para: EstadoDaCelula) => void;
};

export function TabelaDeAcompanhamento({
  rotuloCompetencia,
  anteriorHref,
  proximoHref,
  servicos,
  linhas,
  pendente,
  erro,
  onTrocar,
}: TabelaDeAcompanhamentoProps) {
  return (
    <Pilha espaco={4}>
      <Linha alinhar="centro" espaco={3} quebra>
        <LinkDeAcao href={anteriorHref}>Mês anterior</LinkDeAcao>
        <Texto variante="titulo" como="h2" aria-live="polite">
          {rotuloCompetencia}
        </Texto>
        {proximoHref && <LinkDeAcao href={proximoHref}>Próximo mês</LinkDeAcao>}
      </Linha>

      {erro && (
        <Texto variante="alerta" role="alert">
          {erro}
        </Texto>
      )}

      {linhas.length === 0 ? (
        <Texto variante="apoio">Nenhum cliente com Responsável do RH neste mês.</Texto>
      ) : (
        <Tabela
          colunas={
            <>
              <CabecalhoDeColuna>Cliente</CabecalhoDeColuna>
              {servicos.map((s) => (
                <CabecalhoDeColuna key={s.id}>{s.nome}</CabecalhoDeColuna>
              ))}
              <CabecalhoDeColuna>Pendentes</CabecalhoDeColuna>
            </>
          }
        >
          {linhas.map((linha) => (
            <LinhaDeTabela key={linha.clienteId}>
              <CelulaDeTabela>
                <Texto variante="destaque" como="span">
                  {linha.empresa}
                </Texto>
                <Texto variante="nota">{formatarCnpj(linha.cnpj)}</Texto>
              </CelulaDeTabela>
              {linha.celulas.map((celula) => {
                const nome = servicos.find((s) => s.id === celula.servicoId)?.nome ?? "";
                return (
                  <CelulaDeTabela key={celula.servicoId}>
                    <Select
                      aria-label={`${nome} de ${linha.empresa}`}
                      value={celula.estado}
                      disabled={pendente || !celula.editavel}
                      onChange={(e) =>
                        onTrocar(
                          linha.clienteId,
                          celula.servicoId,
                          celula.estado,
                          e.target.value as EstadoDaCelula,
                        )
                      }
                    >
                      <Opcao value="pendente">Pendente</Opcao>
                      <Opcao value="concluido">Concluído</Opcao>
                      <Opcao value="nao_aplica">Não se aplica</Opcao>
                    </Select>
                  </CelulaDeTabela>
                );
              })}
              <CelulaDeTabela numerica>{linha.pendentes}</CelulaDeTabela>
            </LinhaDeTabela>
          ))}
        </Tabela>
      )}
    </Pilha>
  );
}
