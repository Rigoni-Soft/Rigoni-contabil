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
  guia?: File;
  acordo?: {
    origem: "receita_federal" | "pgfn" | null;
    totalDeParcelas: number | null;
    valorDaParcelaCentavos: number | null;
    dataDeAdesao: string | null;
  };
  acordoResumo?: string;
};

export type LeituraDaLinha = {
  estado: EstadoDeLeitura;
  texto: string;
  cnpjDivergente?: boolean;
};

export type ParcelamentosProps = {
  parcelamentos: ParcelamentoLinha[];
  parcelamentoCampos: { id: string }[];
  onAdicionarParcelamento: () => void;
  onRemoverParcelamento: (indice: number) => void;
  leituras: Record<string, LeituraDaLinha>;
  onArquivoEscolhido: (indice: number, arquivo: File | undefined) => void;
  guiasDaParcela?: (parcelamentoId: string, codigo: string, interno: boolean) => React.ReactNode;
};

export function motivoDeLeituraEmAndamento(
  leituras: Record<string, LeituraDaLinha>,
): string | undefined {
  return Object.values(leituras).some((l) => l.estado === "lendo")
    ? "Aguarde a leitura do PDF para salvar."
    : undefined;
}

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
  parcelamentos: ParcelamentoLinha[];
  parcelamentoCampos: { id: string }[];
  onAdicionar: () => void;
  onRemover: (indice: number) => void;
  leituras: Record<string, LeituraDaLinha>;
  onArquivoEscolhido: (indice: number, arquivo: File | undefined) => void;
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
      <Texto variante="corpo" role="status">
        Tem parcelamento:{" "}
        {parcelamentos.some((p) => p.id)
          ? `Sim (${parcelamentos.filter((p) => p.id).length})`
          : "Não"}
      </Texto>
      {parcelamentos.map((atual, indice) => {
        const erros = errors.parcelamentos?.[indice];
        const leitura = leituras[parcelamentoCampos[indice].id];
        const descricaoDaLeitura = leitura
          ? { "aria-describedby": `parcelamentos-${indice}-leitura` }
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
                        aria-describedby={
                          leitura?.cnpjDivergente
                            ? `parcelamentos-${indice}-cnpj-divergente`
                            : undefined
                        }
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
                    id={`parcelamentos-${indice}-leitura`}
                    estado={leitura?.estado}
                    texto={leitura?.texto}
                  />
                  {leitura?.cnpjDivergente && (
                    <FieldError id={`parcelamentos-${indice}-cnpj-divergente`}>
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
