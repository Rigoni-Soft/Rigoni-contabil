import { Plus } from "lucide-react";
import { Controller, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import {
  IndicadorDeLeitura,
  type EstadoDeLeitura,
} from "@/presentation/components/molecules/indicador-de-leitura.component";
import { LinhaDeParcelamento } from "@/presentation/components/molecules/linha-de-parcelamento.component";
import type { SeloDoParcelamento } from "@/presentation/components/molecules/selo-do-parcelamento.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";

import type { EditarCadastroOperacionalFormValues } from "./editar-cadastro-operacional-form.component";

// Linha da lista de Parcelamentos: o que se edita (código, restantes, interno, PDF novo) e o que a
// tela só exibe (selo do mês, quitado, nome do PDF gravado, se há envio).
export type ParcelamentoLinha = {
  id?: string;
  codigo: string;
  parcelasRestantes: number;
  interno: boolean;
  quitado: boolean;
  temEnvio: boolean;
  enviadoNoMes: boolean;
  arquivoNome: string;
  arquivo?: File;
  // Primeira guia do mês (só no Parcelamento PGFN novo); sobe depois de salvar.
  guia?: File;
  // Dados lidos do PDF; o Container os resume numa linha (`acordoResumo`) para exibir.
  acordo?: {
    origem: "receita_federal" | "pgfn" | null;
    totalDeParcelas: number | null;
    valorDaParcelaCentavos: number | null;
    dataDeAdesao: string | null;
  };
  acordoResumo?: string;
};

// Estado da leitura do PDF numa linha nova (só exibição; quem lê é o Container, e o texto já vem pronto).
export type LeituraDaLinha = {
  estado: EstadoDeLeitura;
  texto: string;
  // O CNPJ lido do PDF é de outra empresa: alerta próprio, sem bloquear.
  cnpjDivergente?: boolean;
};

// Linha ainda não salva não tem status do mês: sem selo.
function seloDoParcelamento(p: ParcelamentoLinha): SeloDoParcelamento | undefined {
  if (!p.id) return undefined;
  if (p.quitado) return "quitado";
  return p.enviadoNoMes ? "enviado" : "pendente";
}

type ParcelamentosDoCadastroProps = {
  register: UseFormRegister<EditarCadastroOperacionalFormValues>;
  control: Control<EditarCadastroOperacionalFormValues>;
  errors: FieldErrors<EditarCadastroOperacionalFormValues>;
  readOnly: boolean;
  // Linhas atuais do formulário (acompanham a edição): resumo "Sim (n)", selo e nome do PDF.
  parcelamentos: ParcelamentoLinha[];
  parcelamentoCampos: { id: string }[];
  onAdicionar: () => void;
  onRemover: (indice: number) => void;
  // Leitura do PDF por linha (chave = id do campo do useFieldArray).
  leituras: Record<string, LeituraDaLinha>;
  // O PDF escolhido (ou removido) volta ao Container para ser lido.
  onArquivoEscolhido: (indice: number, arquivo: File | undefined) => void;
  // Guias mensais de um Parcelamento PGFN já salvo: o Container monta a região (ela tem estado próprio).
  // `codigo` nomeia a região de cada Parcelamento para o leitor de tela.
  guiasDaParcela?: (parcelamentoId: string, codigo: string, interno: boolean) => React.ReactNode;
};

export function ParcelamentosDoCadastro({
  register,
  control,
  errors,
  readOnly,
  parcelamentos,
  parcelamentoCampos,
  onAdicionar,
  onRemover,
  leituras,
  onArquivoEscolhido,
  guiasDaParcela,
}: ParcelamentosDoCadastroProps) {
  return (
    <Pilha espaco={3} className="sm:col-span-2 lg:col-span-4">
      <Linha alinhar="centro" justificar="entre" espaco={4}>
        <Label className="block">Parcelamentos</Label>
        {!readOnly && (
          <Button type="button" variant="ghost" size="sm" onClick={onAdicionar}>
            <Plus className="size-4" aria-hidden="true" />
            Adicionar parcelamento
          </Button>
        )}
      </Linha>
      {/* Resumo derivado: só conta o que já foi salvo (linha com id), nunca o que está sendo digitado. */}
      <Texto variante="corpo" role="status">
        Tem parcelamento:{" "}
        {parcelamentos.some((p) => p.id)
          ? `Sim (${parcelamentos.filter((p) => p.id).length})`
          : "Não"}
      </Texto>
      {parcelamentos.map((atual, indice) => {
        const erros = errors.parcelamentos?.[indice];
        const leitura = leituras[parcelamentoCampos[indice].id];
        // O estado da leitura descreve os campos que ela preencheu (sugestão a conferir).
        const descricaoDaLeitura = leitura
          ? { "aria-describedby": `parcelamentos.${indice}.leitura` }
          : undefined;
        return (
          <LinhaDeParcelamento
            key={parcelamentoCampos[indice].id}
            somenteLeitura={readOnly}
            indice={indice}
            codigo={{ ...register(`parcelamentos.${indice}.codigo`), ...descricaoDaLeitura }}
            parcelas={{
              ...register(`parcelamentos.${indice}.parcelasRestantes`, { valueAsNumber: true }),
              ...descricaoDaLeitura,
            }}
            interno={register(`parcelamentos.${indice}.interno`)}
            erroCodigo={erros?.codigo?.message}
            erroParcelas={erros?.parcelasRestantes?.message}
            selo={seloDoParcelamento(atual)}
            // Quitado e PGFN cadastrado não se editam (o PGFN só ganha guias): o servidor ignora o que vier.
            desabilitado={
              atual.quitado ||
              (Boolean(atual.id) && atual.acordo?.origem === "pgfn") ||
              leitura?.estado === "lendo"
            }
            onRemover={readOnly || atual.temEnvio ? undefined : () => onRemover(indice)}
            bloqueadoPorEnvio={!readOnly && atual.temEnvio}
            guias={
              !readOnly && atual.id && atual.acordo?.origem === "pgfn" && !atual.quitado
                ? guiasDaParcela?.(atual.id, atual.codigo, atual.interno)
                : undefined
            }
            arquivo={
              atual.id ? (
                <>
                  <Texto variante="nota" className="[overflow-wrap:anywhere]">
                    PDF anexado: {atual.arquivoNome}
                  </Texto>
                  {atual.acordoResumo && <Texto variante="nota">{atual.acordoResumo}</Texto>}
                </>
              ) : (
                <>
                  <Controller
                    control={control}
                    name={`parcelamentos.${indice}.arquivo`}
                    render={({ field: { onChange, onBlur, value, name } }) => (
                      <CampoDeArquivo
                        id={`parcelamentos.${indice}.arquivo`}
                        rotulo="PDF do acordo"
                        name={name}
                        accept="application/pdf"
                        dica="PDF até 4 MB"
                        file={value}
                        onChange={(arquivo) => {
                          onChange(arquivo);
                          onArquivoEscolhido(indice, arquivo);
                        }}
                        onBlur={onBlur}
                        erro={erros?.arquivo?.message}
                      />
                    )}
                  />
                  <IndicadorDeLeitura
                    id={`parcelamentos.${indice}.leitura`}
                    estado={leitura?.estado}
                    texto={leitura?.texto}
                  />
                  {leitura?.cnpjDivergente && (
                    <FieldError>
                      O CNPJ do PDF é diferente do CNPJ do Cliente. Confira se anexou o PDF certo.
                    </FieldError>
                  )}
                  {atual.acordoResumo && <Texto variante="nota">{atual.acordoResumo}</Texto>}
                  {atual.acordo?.origem === "pgfn" && (
                    <Controller
                      control={control}
                      name={`parcelamentos.${indice}.guia`}
                      render={({ field: { onChange, onBlur, value, name } }) => (
                        <CampoDeArquivo
                          id={`parcelamentos.${indice}.guia`}
                          rotulo="PDF da guia (opcional)"
                          name={name}
                          accept="application/pdf"
                          dica="PDF até 4 MB. Sobe ao salvar; depois anexe as demais em Guias da parcela."
                          compacto
                          file={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          erro={erros?.guia?.message}
                        />
                      )}
                    />
                  )}
                </>
              )
            }
          />
        );
      })}
      {/* Erro da lista (ex.: soma dos PDFs): o resolver o entrega em `message` ou em `root`. */}
      {(errors.parcelamentos?.root?.message ?? errors.parcelamentos?.message) && (
        <FieldError>
          {errors.parcelamentos?.root?.message ?? errors.parcelamentos?.message}
        </FieldError>
      )}
      <Texto variante="nota">
        Parcelamento da PGFN: a guia de cada mês é anexada aqui, confirmada à mão e segue ao Cliente
        pelo envio automático.
      </Texto>
    </Pilha>
  );
}
