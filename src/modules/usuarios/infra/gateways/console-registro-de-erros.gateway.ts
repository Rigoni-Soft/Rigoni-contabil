import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";

export class ConsoleRegistroDeErrosGateway implements RegistroDeErrosPort {
  registrar(mensagem: string, ...detalhes: unknown[]): void {
    console.error(mensagem, ...detalhes);
  }
}
