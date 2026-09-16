"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MENU = [
  { href: "/", label: "덱 추천", match: (p: string) => p === "/" || p.startsWith("/recommend") },
  { href: "/decks", label: "덱 목록", match: (p: string) => p.startsWith("/deck") },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-gold/20 bg-navy/85 backdrop-blur">
      <nav className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4">
        <Link href="/" className="gold-text mr-4 font-serif text-lg font-bold uppercase tracking-[0.2em]">
          TFT Pick
        </Link>
        {MENU.map((m) => {
          const active = m.match(path);
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`border-b-2 px-3 py-3 text-sm transition ${
                active ? "border-gold font-semibold text-gold-light" : "border-transparent text-muted hover:text-parchment"
              }`}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
