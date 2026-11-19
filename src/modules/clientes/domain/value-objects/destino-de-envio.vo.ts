import { Contato, type ContatoEditavel } from "@/modules/clientes/domain/value-objects/contato.vo";
import { ValidationError } from "@/shared/errors/validation.error";
import { canaisDoContato, FORMAS_ENVIO, type FormaEnvioValor } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";

// O Contato de um Destino: um já cadastrado (só o id) ou um novo, criado junto com o Destino.
export type ContatoDoDestino = { id: string } | { novo: ContatoEditavel };

export type DestinoDeEnvioProps = {
  contato: ContatoDoDestino;
  // null = "todos os envios do Setor"; senão, um tipo do catálogo do Setor (o banco confere).
  tipo: string | null;
  canal: string;
};

// O que o Setor define: para qual Contato, para qual Tipo de envio, por qual canal. O canal é explícito:
// o do Contato, se ele tem um só, ou o que o responsável escolhe, se tem os dois.
export class DestinoDeEnvio {
  private constructor(
    readonly contato: ContatoDoDestino,
    readonly tipo: string | null,
    readonly canal: FormaEnvioValor,
  ) {}

  static criar(entrada: DestinoDeEnvioProps): Result<DestinoDeEnvio, ValidationError> {
    if (!FORMAS_ENVIO.includes(entrada.canal as FormaEnvioValor)) {
      return err(new ValidationError("Escolha a forma de envio."));
    }
    const canal = entrada.canal as FormaEnvioValor;
    const tipo = entrada.tipo?.trim() || null;

    if ("id" in entrada.contato) {
      if (!entrada.contato.id) return err(new ValidationError("Escolha um contato."));
      // O canal do Contato já cadastrado é conferido no banco (o Contato pode ter mudado).
      return ok(new DestinoDeEnvio({ id: entrada.contato.id }, tipo, canal));
    }

    const novo = Contato.criar(entrada.contato.novo);
    if (!novo.ok) return novo;
    if (!canaisDoContato(novo.value).includes(canal)) {
      return err(new ValidationError("O contato não tem o canal escolhido."));
    }
    const { nome, telefone, email } = novo.value;
    return ok(new DestinoDeEnvio({ novo: { nome, telefone, email } }, tipo, canal));
  }
}
