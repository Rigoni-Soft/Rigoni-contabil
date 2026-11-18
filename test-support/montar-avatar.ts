import type { AuditoriaPort } from "@/modules/usuarios/application/ports/out/auditoria.provider";
import type { AvatarArmazenamentoPort } from "@/modules/usuarios/application/ports/out/avatar-armazenamento.provider";
import type { AvatarMarcaPort } from "@/modules/usuarios/application/ports/out/avatar-marca.provider";
import type { RegistroDeErrosPort } from "@/modules/usuarios/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/usuarios/application/ports/out/sessao.provider";
import type { UsuarioRepository } from "@/modules/usuarios/application/ports/out/usuario.repository";
import { EnviarAvatar } from "@/modules/usuarios/application/use-cases/enviar-avatar.use-case";
import { ObterAvatar } from "@/modules/usuarios/application/use-cases/obter-avatar.use-case";
import { RemoverAvatar } from "@/modules/usuarios/application/use-cases/remover-avatar.use-case";
import { Usuario, type UsuarioId } from "@/modules/usuarios/domain/entities/usuario.entity";
import { AppError } from "@/shared/errors/app.error";
import { err, ok, type Result } from "@/shared/kernel/result";

export class FalhaTecnica extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

export const ascii = (texto: string) => [...Buffer.from(texto, "ascii")];

export function webp(): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set(ascii("RIFF"), 0);
  bytes.set(ascii("WEBP"), 8);
  return bytes;
}

export function usuario(
  id: string,
  papel: string,
  extras: { avatar?: string | null; desativadoEm?: string | null } = {},
): Usuario {
  const resultado = Usuario.builder()
    .restaurar({
      id,
      nome: `Nome ${id}`,
      email: `${id}@rigonicontabil.local`,
      papel,
      setor: "simples_nacional",
      senhaTrocadaEm: "2026-10-01T10:00:00Z",
      senhaProvisoriaExpiraEm: "2026-10-10T10:00:00Z",
      avatarAtualizadoEm: extras.avatar ?? null,
      desativadoEm: extras.desativadoEm ?? null,
    })
    .build();
  if (!resultado.ok) throw new Error("setup inválido");
  return resultado.value;
}

type Falhas = {
  gravar?: AppError;
  apagar?: AppError;
  ler?: AppError;
  definir?: AppError;
  auditar?: AppError;
};

export function montar(
  opcoes: { atorId?: string | null; perfis?: Usuario[]; objeto?: Uint8Array | null } = {},
) {
  const perfis = opcoes.perfis ?? [usuario("func-1", "funcionario")];
  const chamadas: string[] = [];
  const falhas: Falhas = {};
  const auditorias: { acao: string; resultado: string; alvo: string }[] = [];
  const erros: RegistroDeErrosPort = { registrar: jest.fn() };

  const sessao = {
    usuarioAtualId: async () => (opcoes.atorId === undefined ? "func-1" : opcoes.atorId),
  } as unknown as SessaoPort;
  const usuarios = {
    buscarPorId: async (id: UsuarioId): Promise<Result<Usuario | null, AppError>> =>
      ok(perfis.find((p) => p.id === id) ?? null),
  } as unknown as UsuarioRepository;
  const armazenamento: AvatarArmazenamentoPort = {
    gravar: async (id, bytes) => {
      chamadas.push(`gravar:${id}:${bytes.byteLength}`);
      return falhas.gravar ? err(falhas.gravar) : ok(undefined);
    },
    apagar: async (id) => {
      chamadas.push(`apagar:${id}`);
      return falhas.apagar ? err(falhas.apagar) : ok(undefined);
    },
    ler: async (id) => {
      chamadas.push(`ler:${id}`);
      return falhas.ler
        ? err(falhas.ler)
        : ok(opcoes.objeto === undefined ? webp() : opcoes.objeto);
    },
  };
  const marca: AvatarMarcaPort = {
    definir: async (id, em) => {
      chamadas.push(`definir:${id}:${em === null ? "null" : "data"}`);
      return falhas.definir ? err(falhas.definir) : ok(undefined);
    },
  };
  const auditoria: AuditoriaPort = {
    registrar: async (input) => {
      auditorias.push({ acao: input.acao, resultado: input.resultado, alvo: input.alvo });
      return falhas.auditar ? err(falhas.auditar) : ok(undefined);
    },
  };

  return {
    enviar: new EnviarAvatar(sessao, usuarios, armazenamento, marca, auditoria, erros),
    remover: new RemoverAvatar(sessao, usuarios, armazenamento, marca, auditoria, erros),
    obter: new ObterAvatar(sessao, usuarios, armazenamento),
    chamadas,
    falhas,
    auditorias,
  };
}
