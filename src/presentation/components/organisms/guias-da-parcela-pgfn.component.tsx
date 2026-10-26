import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { BotaoDeArquivo } from "@/presentation/components/atoms/botao-de-arquivo.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { SeloDaGuia } from "@/presentation/components/molecules/selo-da-guia.component";
import { Button } from "@/presentation/components/ui/button";

// O resultado do anexo e o motivo da pendência são o que o Funcionário precisa ler e agir: 14 px, não
// os 12 px do aviso padrão. O ícone desce 2 px para ficar na primeira linha de 20 px (como o FieldError).
const AVISO_LEGIVEL = "text-sm [&>svg]:mt-[3px]";

type GuiaDaListaDto = {
  // Id do item no DOM (alvo do foco depois de confirmar).
  id: string;
  competencia: string;
  rotulo: string;
  contaNegociacao: string;
  confirmada: boolean;
  // O que conferir numa guia "a confirmar" (vem do leitor do PDF; some ao confirmar).
  motivo?: string;
  // Id do botão Remover (alvo do foco ao cancelar a confirmação).
  idDaRemocao: string;
  // Já tem registro de envio: só pode ser aberta, não troca nem remove.
  enviada: boolean;
};

type GuiasDaParcelaPgfnProps = {
  // Prefixo dos ids (um conjunto de campos por Parcelamento na mesma tela).
  id: string;
  // Id da região (alvo do foco depois de remover uma guia); vem pronto do presenter.
  idDaRegiao: string;
  guias: GuiaDaListaDto[];
  carregando: boolean;
  erroDaLista?: string;
  onTentarNovamente: () => void;
  competencia: string;
  onCompetencia: (valor: string) => void;
  contaNegociacao: string;
  onContaNegociacao: (valor: string) => void;
  arquivo?: File;
  onArquivo: (arquivo: File | undefined) => void;
  erros: { competencia?: string; contaNegociacao?: string; arquivo?: string };
  // Qualquer ação em curso (trava os controles); `anexando` é só o envio do PDF (rótulo do botão).
  pendente: boolean;
  anexando: boolean;
  erroServidor?: string;
  // Sucesso, ou atenção (anexada mas "a confirmar": o que fazer; não é sucesso nem erro).
  resultado?: { tipo: "sucesso" | "atencao"; texto: string };
  onAnexar: () => void;
  onConfirmar: (competencia: string) => void;
  onTrocar: (competencia: string, arquivo: File) => void;
  // Competência cuja remoção espera confirmação (apaga registro e PDF, sem desfazer).
  removendo?: string;
  onPedirRemocao: (competencia: string) => void;
  onCancelarRemocao: (competencia: string) => void;
  onRemover: (competencia: string) => void;
  onVisualizar: (competencia: string) => void;
};

const BOTAO_DA_GUIA =
  "aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11";

// "Anexar guia do mês" na linha de um Parcelamento PGFN. Fica dentro do formulário do cadastro, então
// nada aqui é <form> (nem submete): os botões são `button` e cada ação vai por Server Action própria.
export function GuiasDaParcelaPgfn({
  id,
  idDaRegiao,
  guias,
  carregando,
  erroDaLista,
  onTentarNovamente,
  competencia,
  onCompetencia,
  contaNegociacao,
  onContaNegociacao,
  arquivo,
  onArquivo,
  erros,
  pendente,
  anexando,
  erroServidor,
  resultado,
  onAnexar,
  onConfirmar,
  onTrocar,
  removendo,
  onPedirRemocao,
  onCancelarRemocao,
  onRemover,
  onVisualizar,
}: GuiasDaParcelaPgfnProps) {
  return (
    <Pilha
      espaco={3}
      role="group"
      aria-label="Guias da parcela"
      id={idDaRegiao}
      tabIndex={-1}
      className="border-t border-border pt-3 outline-none"
    >
      <Pilha espaco={1}>
        <Texto variante="rotulo">Guias da parcela (PGFN)</Texto>
        {erroDaLista && (
          <AvisoComAcao
            texto={erroDaLista}
            rotuloDaAcao="Tentar novamente"
            onAcao={onTentarNovamente}
          />
        )}
        {!carregando && !erroDaLista && guias.length === 0 && (
          <Texto variante="nota">Nenhuma guia anexada.</Texto>
        )}
      </Pilha>
      {guias.length > 0 && (
        <Pilha como="ul" espaco={2}>
          {guias.map((guia) => (
            <Caixa
              como="li"
              key={guia.competencia}
              id={guia.id}
              tabIndex={-1}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Linha alinhar="centro" justificar="entre" espaco={3} quebra>
                <Texto variante="corpo" className="min-w-0 [overflow-wrap:anywhere] tabular-nums">
                  {guia.rotulo} · conta {guia.contaNegociacao}
                </Texto>
                <Linha alinhar="centro" espaco={2} quebra>
                  <SeloDaGuia confirmada={guia.confirmada} />
                  {guia.enviada && <Texto variante="nota">Enviada</Texto>}
                </Linha>
              </Linha>
              {!guia.confirmada && guia.motivo && (
                <Texto
                  variante="nota"
                  id={`${guia.id}-motivo`}
                  className="mt-1 text-sm [overflow-wrap:anywhere]"
                >
                  {guia.motivo}
                </Texto>
              )}
              <Linha alinhar="centro" espaco={2} quebra className="mt-2">
                {!guia.confirmada && !guia.enviada && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-disabled={pendente || undefined}
                    onClick={() => onConfirmar(guia.competencia)}
                    aria-label={`Confirmar guia de ${guia.rotulo}`}
                    aria-describedby={guia.motivo ? `${guia.id}-motivo` : undefined}
                    className={BOTAO_DA_GUIA}
                  >
                    Confirmar
                  </Button>
                )}
                <Linha alinhar="centro" espaco={1} quebra className="ml-auto">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-disabled={pendente || undefined}
                    onClick={() => onVisualizar(guia.competencia)}
                    aria-label={`Ver guia de ${guia.rotulo}`}
                    className={BOTAO_DA_GUIA}
                  >
                    Ver
                  </Button>
                  {!guia.enviada && (
                    <>
                      <BotaoDeArquivo
                        rotulo="Trocar"
                        rotuloAcessivel={`Trocar guia de ${guia.rotulo}`}
                        aceitar="application/pdf"
                        ocupado={pendente}
                        onEscolher={(novo) => onTrocar(guia.competencia, novo)}
                      />
                      {removendo === guia.competencia ? (
                        <>
                          <Texto variante="nota" role="alert">
                            Apaga a guia e o PDF.
                          </Texto>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            aria-disabled={pendente || undefined}
                            onClick={() => onRemover(guia.competencia)}
                            aria-label={`Confirmar remoção da guia de ${guia.rotulo}`}
                            className={BOTAO_DA_GUIA}
                          >
                            Confirmar remoção
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            // Quem abriu a confirmação sem querer cai no gesto seguro.
                            autoFocus
                            onClick={() => onCancelarRemocao(guia.competencia)}
                            aria-label={`Cancelar remoção da guia de ${guia.rotulo}`}
                            className={BOTAO_DA_GUIA}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          id={guia.idDaRemocao}
                          variant="ghost"
                          size="sm"
                          aria-disabled={pendente || undefined}
                          onClick={() => onPedirRemocao(guia.competencia)}
                          aria-label={`Remover guia de ${guia.rotulo}`}
                          className={BOTAO_DA_GUIA}
                        >
                          Remover
                        </Button>
                      )}
                    </>
                  )}
                </Linha>
              </Linha>
            </Caixa>
          ))}
        </Pilha>
      )}

      <Pilha espaco={3}>
        <Texto variante="nota" id={`${id}-leitura`}>
          O sistema lê o PDF; digite só se ele não conseguir.
        </Texto>
        <Linha alinhar="fim" espaco={3} quebra>
          <CampoDeTexto
            id={`${id}-competencia`}
            rotulo="Competência (opcional)"
            type="month"
            // Navegador sem seletor de mês (ex.: Firefox no desktop) mostra texto livre: o formato vai no placeholder.
            placeholder="AAAA-MM"
            aria-describedby={`${id}-leitura`}
            value={competencia}
            onChange={(evento) => onCompetencia(evento.target.value)}
            erro={erros.competencia}
            disabled={anexando}
            className="min-w-[10rem] flex-1 gap-1"
          />
          <CampoDeTexto
            id={`${id}-conta`}
            rotulo="Conta de negociação (opcional)"
            maxLength={40}
            aria-describedby={`${id}-leitura`}
            value={contaNegociacao}
            onChange={(evento) => onContaNegociacao(evento.target.value)}
            erro={erros.contaNegociacao}
            disabled={anexando}
            className="min-w-[10rem] flex-1 gap-1"
          />
        </Linha>
        <CampoDeArquivo
          id={`${id}-arquivo`}
          rotulo="PDF da guia"
          accept="application/pdf"
          dica="PDF até 4 MB"
          file={arquivo}
          onChange={onArquivo}
          erro={erros.arquivo}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-disabled={pendente || undefined}
          onClick={onAnexar}
          className={BOTAO_DA_GUIA}
        >
          {anexando ? "Enviando..." : "Anexar guia"}
        </Button>
        {erroServidor && <FieldError>{erroServidor}</FieldError>}
        {resultado && (
          <AvisoDeStatus tipo={resultado.tipo} texto={resultado.texto} className={AVISO_LEGIVEL} />
        )}
      </Pilha>
    </Pilha>
  );
}
