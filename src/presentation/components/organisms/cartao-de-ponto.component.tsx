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
  acaoDeAtestado?: React.ReactNode;
  empresa: string;
  rotuloMes: string;
  mesAnteriorHref: string;
  proximoMesHref?: string;
  linhas: LinhaDoCartao[];
  diasEmEdicao: string[];
  diasLimpos: string[];
  focoNoDia?: string;
  versoes: Record<string, number>;
  listaHref: string;
  totalizacaoDestacada: boolean;
  cartaoNovo: boolean;
  avisoGeral?: AvisoDoDia;
  onEditarDia: (data: string) => void;
  onAbonarDia: (data: string) => void;
  onDesfazerAbonoDia: (data: string) => void;
  onCancelarDia: (data: string) => void;
  onSalvarTabela: () => void;
  onLimparTabela: () => void;
  onBaixarPdf: () => void;
  baixandoPdf: boolean;
  avisoDoPdf?: AvisoDoDia;
  motivoSemPdf?: string;
  totalizacao: ItemDaTotalizacao[];
  avisoDaTotalizacao?: string;
  editavel: boolean;
  pendente: boolean;
  aviso?: AvisoDoDia & { data: string };
  empregadoId: string;
  onSalvarDia: (data: string, campos: FormData) => void;
};

export function CartaoDePonto({
  empregado,
  acaoDeAtestado,
  empresa,
  rotuloMes,
  mesAnteriorHref,
  proximoMesHref,
  linhas,
  diasEmEdicao,
  diasLimpos,
  focoNoDia,
  versoes,
  listaHref,
  totalizacaoDestacada,
  cartaoNovo,
  avisoGeral,
  onEditarDia,
  onAbonarDia,
  onDesfazerAbonoDia,
  onCancelarDia,
  onSalvarTabela,
  onLimparTabela,
  onBaixarPdf,
  baixandoPdf,
  avisoDoPdf,
  motivoSemPdf,
  totalizacao,
  avisoDaTotalizacao,
  editavel,
  pendente,
  aviso,
  empregadoId,
  onSalvarDia,
}: Props) {
  const semLinhaAberta = diasEmEdicao.length === 0;
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
        Empresa: {empresa} · Período: {rotuloMes}
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
        legenda={`Cartão de ponto de ${empregado}, ${rotuloMes}`}
        semMoldura
        grade
        agrupamento={
          <>
            <CabecalhoDeColuna colSpan={2}>
              <Texto como="span" variante="somenteLeitor">
                Identificação do dia
              </Texto>
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={6} centro>
              Batidas
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={4} centro>
              Horas extras / Atrasos / Adicional noturno
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={2} centro>
              Horas extras por faixa
            </CabecalhoDeColuna>
            <CabecalhoDeColuna colSpan={1}>
              <Texto como="span" variante="somenteLeitor">
                Ação
              </Texto>
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
            focar={focoNoDia === linha.data}
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
            {acaoDeAtestado}
            <Button
              type="button"
              disabled={pendente}
              aria-disabled={semLinhaAberta}
              onClick={semLinhaAberta ? undefined : onSalvarTabela}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
            >
              Salvar
            </Button>
            <Button
              type="button"
              variant="warning"
              disabled={pendente}
              aria-disabled={semLinhaAberta}
              onClick={semLinhaAberta ? undefined : onLimparTabela}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-warning"
            >
              Limpar
            </Button>
            <LinkDeAcao href={listaHref} variant="destructive">
              Cancelar
            </LinkDeAcao>
          </Linha>
          {avisoGeral && <AvisoDeStatus tipo={avisoGeral.tipo} legivel texto={avisoGeral.texto} />}
        </Pilha>
      )}
      {!editavel && cartaoNovo && (
        <Texto variante="apoio">
          Cartão ainda não iniciado: as faltas só contam depois que o Responsável do RH o salvar.
        </Texto>
      )}
      {avisoDaTotalizacao && <Texto variante="apoio">{avisoDaTotalizacao}</Texto>}
      <TotalizacaoDoPonto
        titulo="Totalização do mês"
        itens={totalizacao}
        destaque={totalizacaoDestacada}
      />
      {motivoSemPdf ? (
        <Texto variante="apoio">{motivoSemPdf}</Texto>
      ) : (
        <Pilha espaco={2}>
          <Linha espaco={3} quebra alinhar="centro" justificar="fim">
            <Texto id="apoio-do-pdf" variante="apoio">
              O PDF traz o que está salvo, com a Totalização do mês.
            </Texto>
            <Button
              type="button"
              variant="outline"
              aria-disabled={baixandoPdf || undefined}
              aria-describedby="apoio-do-pdf"
              onClick={baixandoPdf ? undefined : onBaixarPdf}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent pointer-coarse:min-h-11"
            >
              {baixandoPdf ? "Gerando PDF…" : "Baixar PDF"}
            </Button>
          </Linha>
          {avisoDoPdf && <AvisoDeStatus tipo={avisoDoPdf.tipo} legivel texto={avisoDoPdf.texto} />}
        </Pilha>
      )}
    </Pilha>
  );
}
