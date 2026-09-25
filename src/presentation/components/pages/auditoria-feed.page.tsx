import Link from "next/link";

type AuditoriaFeedPageProps = { header: React.ReactNode; feed: React.ReactNode };

export function AuditoriaFeedPage({ header, feed }: AuditoriaFeedPageProps) {
  return (
    <main className="min-h-screen bg-background">
      {header}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Link href="/" className="text-sm text-muted-foreground hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 mb-6 text-xl font-bold tracking-tight text-primary">
          Auditoria — feed bruto
        </h1>
        {feed}
      </div>
    </main>
  );
}
