import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import {
  CabecalhoDeColuna,
  CelulaDeTabela,
  LinhaDeTabela,
  Tabela,
} from "@/presentation/components/atoms/celula-de-tabela.component";
import { LinkDeAcao } from "@/presentation/components/atoms/link-de-acao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import {
  LinhaDoCartaoDePonto,
  type AvisoDoDia,
  type LinhaDoCartao,
} from "@/presentation/components/molecules/linha-do-cartao-de-ponto.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";
import {
  TotalizacaoDoPonto,
  type ItemDaTotalizacao,
} from "@/presentation/components/molecules/totalizacao-do-ponto.component";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";

// A linha TOTAIS da planilha: faltas e a soma de cada coluna calculada do período.
export type TotaisDoCartao = {
  faltas: string;
  trabalhado: string;
  atraso: string;
  extras: string;
  noturno: string;
  // "1h11 (50%) · 9h45 (100%)".
  faixas: string;
};

type Props = {
  empregado: string;
  empresa: string;
  // Mês do cartão, por extenso.
  periodo: string;
  // A carga horária do empregado por dia da semana (a Jornada gravada).
  cargaHoraria: ItemDaTotalizacao[];
  rotuloMes: string;
  mesAnteriorHref: string;
  proximoMesHref?: string;
  linhas: LinhaDoCartao[];
  totais: TotaisDoCartao;
  totalizacao: ItemDaTotalizacao[];
  // Quando a Totalização usou a legislação por falta de convenção vigente.
  avisoDaTotalizacao?: string;
  editavel: boolean;
  pendente: boolean;
  // Resultado do último "Salvar", mostrado na linha do dia a que se refere.
  aviso?: AvisoDoDia & { data: string };
  // Troca com o empregado escolhido: os campos de cada dia recomeçam dos valores dele.
  empregadoId: string;
  onSalvarDia: (data: string, campos: FormData) => void;
};

// O Cartão de ponto de um empregado no mês inteiro (28 a 31 dias), com a Totalização logo abaixo (a que vai para o PDF).
export function CartaoDePonto({
  empregado,
  empresa,
  periodo,
  cargaHoraria,
  rotuloMes,
  mesAnteriorHref,
  proximoMesHref,
  linhas,
  totais,
  totalizacao,
  avisoDaTotalizacao,
  editavel,
  pendente,
  aviso,
  empregadoId,
  onSalvarDia,
}: Props) {
  return (
    <Pilha
      como="section"
      espaco={6}
      aria-label={`Cartão de ponto de ${empregado}`}
      className={MOLDURA_DO_CARTAO}
    >
      <Texto como="h2" variante="subtitulo">
        Cartão de ponto de {empregado}
      </Texto>
      <Texto variante="apoio">
        Empresa: {empresa} · Período: {periodo}
      </Texto>
      <NavegacaoDeMes
        rotuloMes={rotuloMes}
        anteriorHref={mesAnteriorHref}
        proximoHref={proximoMesHref}
        destaque
      />
      <TotalizacaoDoPonto titulo="Carga horária por dia da semana" itens={cargaHoraria} />
      {!editavel && (
        <Texto variante="apoio">
          Só o Responsável do RH do cliente digita o cartão; aqui ele fica em leitura.
        </Texto>
      )}
      <Tabela
        legenda={`Cartão de ponto de ${empregado}, ${periodo}`}
        semMoldura
        grade
        agrupamento={
          <>
            <CabecalhoDeColuna colSpan={8} centro>
              Batidas
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={5} centro>
              H.E. / Atrasos / A.N.
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={2} centro>
              Distrib. H.E. p/ Faixa
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={1} centro>
              Dia
            </CabecalhoDeColuna>
          </>
        }
        colunas={
          <>
            <CabecalhoDeColuna fixa>Data</CabecalhoDeColuna>
            <CabecalhoDeColuna>Dia semana</CabecalhoDeColuna>
            <CabecalhoDeColuna>Entrada</CabecalhoDeColuna>
            <CabecalhoDeColuna>Saída</CabecalhoDeColuna>
            <CabecalhoDeColuna>Entrada</CabecalhoDeColuna>
            <CabecalhoDeColuna>Saída</CabecalhoDeColuna>
            <CabecalhoDeColuna>Extra entrada</CabecalhoDeColuna>
            <CabecalhoDeColuna>Extra saída</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>H. Diária</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>Atrasos</CabecalhoDeColuna>
            <CabecalhoDeColuna centro>Abono</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>Horas Extras</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>A.N.</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>1ª Faixa</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>2ª Faixa</CabecalhoDeColuna>
            <CabecalhoDeColuna>Salvar</CabecalhoDeColuna>
          </>
        }
        rodape={
          <LinhaDeTabela>
            <CelulaDeTabela colSpan={2}>Totais</CelulaDeTabela>
            <CelulaDeTabela colSpan={6}>Faltas / Suspensão: {totais.faltas}</CelulaDeTabela>
            <CelulaDeTabela numerica>{totais.trabalhado}</CelulaDeTabela>
            <CelulaDeTabela numerica>{totais.atraso}</CelulaDeTabela>
            <CelulaDeTabela>{null}</CelulaDeTabela>
            <CelulaDeTabela numerica>{totais.extras}</CelulaDeTabela>
            <CelulaDeTabela numerica>{totais.noturno}</CelulaDeTabela>
            <CelulaDeTabela colSpan={3}>{totais.faixas}</CelulaDeTabela>
          </LinhaDeTabela>
        }
      >
        {linhas.map((linha) => (
          <LinhaDoCartaoDePonto
            key={`${empregadoId}|${linha.data}`}
            aviso={aviso?.data === linha.data ? aviso : undefined}
            linha={linha}
            editavel={editavel}
            pendente={pendente}
            onSalvar={onSalvarDia}
          />
        ))}
      </Tabela>
      {avisoDaTotalizacao && <Texto variante="apoio">{avisoDaTotalizacao}</Texto>}
      <TotalizacaoDoPonto titulo="Totalização do mês" itens={totalizacao} />
    </Pilha>
  );
}
