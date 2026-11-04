import { Pilha } from "@/presentation/components/atoms/caixa.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";
import { Select } from "@/presentation/components/ui/select";
import { formatarCnpj } from "@/presentation/lib/cnpj-mask";
import { cn } from "@/presentation/lib/utils";

type Servico = { id: string; nome: string };
export type EstadoDaCelula = "pendente" | "concluido" | "nao_aplica";
// `bloqueio` é o motivo de a célula não aceitar troca (ausente = editável).
type Celula = { servicoId: string; estado: EstadoDaCelula; bloqueio?: string };

const CLASSE_DO_ESTADO: Record<EstadoDaCelula, string> = {
  pendente: "",
  concluido: "border-success/50 bg-success/15",
  nao_aplica: "border-dashed bg-muted text-muted-foreground",
};
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
      <NavegacaoDeMes
        rotuloMes={rotuloCompetencia}
        anteriorHref={anteriorHref}
        proximoHref={proximoHref}
      />

      {erro && (
        <Texto variante="alerta" role="alert">
          {erro}
        </Texto>
      )}

      {linhas.length === 0 ? (
        <Texto variante="apoio">Nenhum cliente com Responsável do RH neste mês.</Texto>
      ) : (
        <Tabela
          legenda={`Serviços por cliente em ${rotuloCompetencia}`}
          colunas={
            <>
              <CabecalhoDeColuna fixa>Cliente</CabecalhoDeColuna>
              {servicos.map((s) => (
                <CabecalhoDeColuna key={s.id}>{s.nome}</CabecalhoDeColuna>
              ))}
              <CabecalhoDeColuna numerica>Pendentes</CabecalhoDeColuna>
            </>
          }
        >
          {linhas.map((linha) => (
            <LinhaDeTabela key={linha.clienteId}>
              <CelulaDeTabela fixa>
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
                      aria-describedby={celula.bloqueio ? `bloqueio-${linha.clienteId}-${celula.servicoId}` : undefined}
                      value={celula.estado}
                      className={cn(CLASSE_DO_ESTADO[celula.estado], pendente && "cursor-wait opacity-70")}
                      disabled={!!celula.bloqueio}
                      title={celula.bloqueio}
                      aria-busy={pendente}
                      onChange={(e) =>
                        !pendente &&
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
                    {celula.bloqueio && (
                      <Texto
                        como="span"
                        variante="somenteLeitor"
                        id={`bloqueio-${linha.clienteId}-${celula.servicoId}`}
                      >
                        {celula.bloqueio}
                      </Texto>
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
