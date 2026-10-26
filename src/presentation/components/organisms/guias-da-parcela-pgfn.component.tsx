import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AvisoComAcao } from "@/presentation/components/molecules/aviso-com-acao.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { SeloDaGuia } from "@/presentation/components/molecules/selo-da-guia.component";
import { Button } from "@/presentation/components/ui/button";

type GuiaDaListaDto = {
  // Id do item no DOM (alvo do foco depois de confirmar).
  id: string;
  competencia: string;
  rotulo: string;
  contaNegociacao: string;
  confirmada: boolean;
};

type GuiasDaParcelaPgfnProps = {
  // Prefixo dos ids (um conjunto de campos por Parcelamento na mesma tela).
  id: string;
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
  sucesso?: string;
  onAnexar: () => void;
  onConfirmar: (competencia: string) => void;
};

// "Anexar guia do mês" na linha de um Parcelamento PGFN. Fica dentro do formulário do cadastro, então
// nada aqui é <form> (nem submete): os botões são `button` e cada ação vai por Server Action própria.
export function GuiasDaParcelaPgfn({
  id,
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
  sucesso,
  onAnexar,
  onConfirmar,
}: GuiasDaParcelaPgfnProps) {
  return (
    <Pilha
      espaco={3}
      role="group"
      aria-label="Guias da parcela"
      className="border-t border-border pt-3"
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
                <Linha alinhar="centro" espaco={3}>
                  <SeloDaGuia confirmada={guia.confirmada} />
                  {!guia.confirmada && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-disabled={pendente || undefined}
                      onClick={() => onConfirmar(guia.competencia)}
                      aria-label={`Confirmar guia de ${guia.rotulo}`}
                      className="aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11"
                    >
                      Confirmar
                    </Button>
                  )}
                </Linha>
              </Linha>
            </Caixa>
          ))}
        </Pilha>
      )}

      <Pilha espaco={3}>
        <Texto variante="nota">O sistema lê o PDF; digite só se ele não conseguir.</Texto>
        <Linha alinhar="fim" espaco={3} quebra>
          <CampoDeTexto
            id={`${id}-competencia`}
            rotulo="Competência (opcional)"
            type="month"
            // Navegador sem seletor de mês (ex.: Firefox no desktop) mostra texto livre: o formato vai no placeholder.
            placeholder="AAAA-MM"
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
          className="aria-disabled:pointer-events-none aria-disabled:opacity-50 pointer-coarse:min-h-11"
        >
          {anexando ? "Enviando..." : "Anexar guia"}
        </Button>
        {erroServidor && <FieldError>{erroServidor}</FieldError>}
        {sucesso && <AvisoDeStatus tipo="sucesso" texto={sucesso} />}
      </Pilha>
    </Pilha>
  );
}
