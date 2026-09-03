"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Accueil" },
  { href: "/transactions", label: "Opérations" },
  { href: "/import", label: "Importer" },
  { href: "/budgets", label: "Budgets" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((t) => {
          const active = t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block py-3 text-center text-[13px] ${
                  active ? "font-medium text-ink" : "text-ink-muted"
                }`}
              >
                <span
                  className={`mx-auto mb-1 block h-1 w-6 rounded-full ${
                    active ? "bg-ink" : "bg-transparent"
                  }`}
                />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
