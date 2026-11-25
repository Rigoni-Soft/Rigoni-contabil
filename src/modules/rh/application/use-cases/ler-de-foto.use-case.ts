import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";

export abstract class LerDeFoto extends EscreverPonto {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    acao: string,
    private readonly erros: RegistroDeErrosPort,
  ) {
    super(sessao, repositorio, auditoria, acao);
  }

  protected async chamarLeitor<T>(evento: string, leitura: () => Promise<T>): Promise<T | null> {
    try {
      return await leitura();
    } catch (falha) {
      this.erros.registrar(evento, falha instanceof Error ? falha.name : "desconhecida");
      return null;
    }
  }

  protected registrarReprovacao(evento: string, motivo: string): void {
    this.erros.registrar(evento, motivo);
  }
}
