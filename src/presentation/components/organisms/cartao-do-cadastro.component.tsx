import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { MOLDURA_DO_CARTAO } from "@/presentation/lib/moldura-do-cartao";
import { cn } from "@/presentation/lib/utils";

import { CabecalhoDoCadastro, type CabecalhoCliente } from "./cabecalho-do-cadastro.component";

type CartaoDoCadastroProps = {
  cabecalho: CabecalhoCliente;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  pendente: boolean;
  readOnly: boolean;
  oculto?: boolean;
  documentoContratual?: React.ReactNode;
  responsavel?: React.ReactNode;
  acompanhamento?: React.ReactNode;
  acoes?: React.ReactNode;
  erroServidor?: string;
  sucesso?: React.ReactNode;
  children: React.ReactNode;
};

export function CartaoDoCadastro({
  cabecalho,
  onSubmit,
  pendente,
  readOnly,
  oculto,
  documentoContratual,
  responsavel,
  acompanhamento,
  acoes,
  erroServidor,
  sucesso,
  children,
}: CartaoDoCadastroProps) {
  return (
    <Pilha
      espaco="formulario"
      como="form"
      onSubmit={onSubmit}
      noValidate
      className={cn(MOLDURA_DO_CARTAO, oculto && "rc-oculto-ate-hidratar")}
    >
      {!readOnly && <NotaDeObrigatorio />}

      <CabecalhoDoCadastro cabecalho={cabecalho} documentoContratual={documentoContratual}>
        {responsavel && <Caixa className="lg:col-start-4">{responsavel}</Caixa>}
      </CabecalhoDoCadastro>

      {acompanhamento}

      <Grade colunas="1>2>4" como="fieldset" disabled={readOnly || pendente} className="gap-4">
        {children}
        {!readOnly && acoes}
      </Grade>

      {erroServidor && <FieldError>{erroServidor}</FieldError>}
      {sucesso}
    </Pilha>
  );
}
