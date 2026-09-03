import Link from "next/link";
import { Nav } from "./Nav";

// Coque commune : en-tête + contenu + barre d'onglets en bas (mobile d'abord)
export function Shell({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <h1 className="text-[22px] font-medium tracking-tight">{title}</h1>
        {action ?? (
          <Link
            href="/settings"
            className="text-sm text-ink-muted underline-offset-4 hover:underline"
          >
            Réglages
          </Link>
        )}
      </header>
      <main className="flex-1 px-4 pb-28">{children}</main>
      <Nav />
    </div>
  );
}
