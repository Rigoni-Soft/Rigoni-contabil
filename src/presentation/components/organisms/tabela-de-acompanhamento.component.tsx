import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";

type Servico = { id: string; nome: string };
type Celula = { servicoId: string; aplica: boolean; concluido: boolean; editavel: boolean };
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
  // Só o Funcionário que é Responsável altera "se aplica" (a mesma regra das caixas).
  podeAlterar: boolean;
  pendente: boolean;
  erro?: string;
  onMarcar: (clienteId: string, servicoId: string, concluido: boolean) => void;
  onAplicar: (clienteId: string, servicoId: string, aplica: boolean) => void;
};

export function TabelaDeAcompanhamento({
  rotuloCompetencia,
  anteriorHref,
  proximoHref,
  servicos,
  linhas,
  podeAlterar,
  pendente,
  erro,
  onMarcar,
  onAplicar,
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
                    {celula.aplica ? (
                      <Linha alinhar="centro" espaco={2}>
                        <CaixaDeMarcacao
                          rotulo="Feito"
                          aria-label={`${nome} de ${linha.empresa}: concluído`}
                          checked={celula.concluido}
                          disabled={pendente || !celula.editavel}
                          onChange={(e) =>
                            onMarcar(linha.clienteId, celula.servicoId, e.target.checked)
                          }
                        />
                        {celula.editavel && podeAlterar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pendente}
                            aria-label={`${nome} de ${linha.empresa}: não se aplica`}
                            onClick={() => onAplicar(linha.clienteId, celula.servicoId, false)}
                          >
                            N/A
                          </Button>
                        )}
                      </Linha>
                    ) : (
                      <Linha alinhar="centro" espaco={2}>
                        <Texto variante="nota" como="span">
                          Não se aplica
                        </Texto>
                        {podeAlterar && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={pendente}
                            aria-label={`${nome} de ${linha.empresa}: voltar a aplicar`}
                            onClick={() => onAplicar(linha.clienteId, celula.servicoId, true)}
                          >
                            Aplicar
                          </Button>
                        )}
                      </Linha>
                    )}
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
