const ROTA_DO_AVATAR = "/api/avatar";

export function srcDoAvatar({
  avatarAtualizadoEm,
  logo,
}: {
  avatarAtualizadoEm?: string | null;
  logo: string;
}): string {
  if (!avatarAtualizadoEm) return logo;
  return `${ROTA_DO_AVATAR}?v=${encodeURIComponent(avatarAtualizadoEm)}`;
}
