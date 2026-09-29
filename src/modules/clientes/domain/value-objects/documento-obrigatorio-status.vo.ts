import { ValidationError } from "@/shared/errors/validation.error";
import {
  DOCUMENTO_OBRIGATORIO_STATUSES,
  type DocumentoObrigatorioStatusValor,
} from "@/shared/kernel/documento-obrigatorio-status";
import { err, ok, type Result } from "@/shared/kernel/result";

export class DocumentoObrigatorioStatus {
  private constructor(private readonly props: { valor: DocumentoObrigatorioStatusValor }) {}

  static criar(entrada: string): Result<DocumentoObrigatorioStatus, ValidationError> {
    if (!DOCUMENTO_OBRIGATORIO_STATUSES.includes(entrada as DocumentoObrigatorioStatusValor)) {
      return err(new ValidationError(`Status de documento obrigatório inválido: ${entrada}`));
    }
    return ok(new DocumentoObrigatorioStatus({ valor: entrada as DocumentoObrigatorioStatusValor }));
  }

  get valor(): DocumentoObrigatorioStatusValor {
    return this.props.valor;
  }
}
