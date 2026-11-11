import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import {
  CabecalhoDeColuna,
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
import { Button } from "@/presentation/components/ui/button";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";

type Props = {
  empregado: string;
  empresa: string;
  // Mês do cartão, por extenso.
  periodo: string;
  rotuloMes: string;
  mesAnteriorHref: string;
  proximoMesHref?: string;
  linhas: LinhaDoCartao[];
  // Os dias abertos para digitar (um lápis clicado): data "AAAA-MM-DD".
  diasEmEdicao: string[];
  // Dias cujos campos o "Limpar" da tabela esvaziou.
  diasLimpos: string[];
  // Sobe quando o dia é cancelado ou limpo: a linha recomeça (remonta) dos valores salvos ou vazios.
  versoes: Record<string, number>;
  // Para onde "Cancelar" leva: a lista de empregados da empresa.
  listaHref: string;
  // Logo depois do "Salvar" da tabela: a Totalização ganha destaque.
  totalizacaoDestacada: boolean;
  // Resultado do "Salvar" da tabela (várias linhas de uma vez).
  avisoGeral?: AvisoDoDia;
  onEditarDia: (data: string) => void;
  onAbonarDia: (data: string) => void;
  onDesfazerAbonoDia: (data: string) => void;
  onCancelarDia: (data: string) => void;
  onSalvarTabela: () => void;
  onLimparTabela: () => void;
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
  rotuloMes,
  mesAnteriorHref,
  proximoMesHref,
  linhas,
  diasEmEdicao,
  diasLimpos,
  versoes,
  listaHref,
  totalizacaoDestacada,
  avisoGeral,
  onEditarDia,
  onAbonarDia,
  onDesfazerAbonoDia,
  onCancelarDia,
  onSalvarTabela,
  onLimparTabela,
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
        {empregado}
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
            <CabecalhoDeColuna colSpan={4} centro>
              Horas extras / Atrasos / Adicional noturno
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={2} centro>
              Horas extras por faixa
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
            <CabecalhoDeColuna numerica>Horas Extras</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>Adicional noturno</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>1ª Faixa</CabecalhoDeColuna>
            <CabecalhoDeColuna numerica>2ª Faixa</CabecalhoDeColuna>
            <CabecalhoDeColuna>
              {/* O botão já diz o que faz: a coluna fica sem título visível. */}
              <Texto como="span" variante="somenteLeitor">
                Salvar o dia
              </Texto>
            </CabecalhoDeColuna>
          </>
        }
      >
        {linhas.map((linha) => (
          <LinhaDoCartaoDePonto
            key={`${empregadoId}|${linha.data}|${versoes[linha.data] ?? 0}`}
            aviso={aviso?.data === linha.data ? aviso : undefined}
            linha={linha}
            editavel={editavel}
            emEdicao={diasEmEdicao.includes(linha.data)}
            limpa={diasLimpos.includes(linha.data)}
            pendente={pendente}
            onEditar={onEditarDia}
            onAbonar={onAbonarDia}
            onDesfazerAbono={onDesfazerAbonoDia}
            onCancelar={onCancelarDia}
            onSalvar={onSalvarDia}
          />
        ))}
      </Tabela>
      {editavel && (
        <Pilha espaco={2}>
          <Linha espaco={3} quebra alinhar="centro" justificar="fim">
            {/* Salva as linhas abertas e fica na tela, com a Totalização em destaque. */}
            <Button
              type="button"
              disabled={pendente || diasEmEdicao.length === 0}
              onClick={onSalvarTabela}
            >
              Salvar
            </Button>
            {/* Esvazia os campos das linhas abertas e fica na tela (só vale ao salvar). */}
            <Button
              type="button"
              variant="warning"
              disabled={pendente || diasEmEdicao.length === 0}
              onClick={onLimparTabela}
            >
              Limpar
            </Button>
            {/* Descarta o que foi digitado e volta à lista de empregados da empresa. */}
            <LinkDeAcao href={listaHref} variant="destructive">
              Cancelar
            </LinkDeAcao>
          </Linha>
          {avisoGeral && <AvisoDeStatus tipo={avisoGeral.tipo} legivel texto={avisoGeral.texto} />}
        </Pilha>
      )}
      {avisoDaTotalizacao && <Texto variante="apoio">{avisoDaTotalizacao}</Texto>}
      <TotalizacaoDoPonto
        titulo="Totalização do mês"
        itens={totalizacao}
        destaque={totalizacaoDestacada}
      />
    </Pilha>
  );
}
