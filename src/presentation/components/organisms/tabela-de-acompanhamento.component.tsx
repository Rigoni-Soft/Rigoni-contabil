import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
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
  competencia: string;
  meses: { valor: string; rotulo: string }[];
  action: string;
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
  competencia,
  meses,
  action,
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
      <Linha como="form" method="get" action={action} alinhar="fim" espaco={3}>
        <CampoSelect id="mes" name="mes" rotulo="Competência" defaultValue={competencia}>
          {meses.map((m) => (
            <Opcao key={m.valor} value={m.valor}>
              {m.rotulo}
            </Opcao>
          ))}
        </CampoSelect>
        <Button type="submit" variant="outline">
          Ver mês
        </Button>
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
                    <Pilha espaco={1}>
                      <CaixaDeMarcacao
                        rotulo="Concluído"
                        aria-label={`${nome} de ${linha.empresa}: concluído`}
                        checked={celula.concluido}
                        disabled={pendente || !celula.editavel || !celula.aplica}
                        onChange={(e) =>
                          onMarcar(linha.clienteId, celula.servicoId, e.target.checked)
                        }
                      />
                      {celula.editavel && (
                        <CaixaDeMarcacao
                          rotulo="Não se aplica"
                          aria-label={`${nome} de ${linha.empresa}: não se aplica`}
                          checked={!celula.aplica}
                          disabled={pendente || !podeAlterar}
                          onChange={(e) =>
                            onAplicar(linha.clienteId, celula.servicoId, !e.target.checked)
                          }
                        />
                      )}
                    </Pilha>
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
