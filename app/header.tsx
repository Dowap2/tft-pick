"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import meta from "@/lib/gen/meta.json";

const MENU = [
  { href: "/", label: "덱 추천", match: (p: string) => p === "/" || p.startsWith("/recommend") },
  { href: "/decks", label: "덱 티어 리스트", match: (p: string) => p.startsWith("/deck") },
  { href: "/champions", label: "챔피언", match: (p: string) => p.startsWith("/champions") },
  { href: "/items", label: "아이템", match: (p: string) => p.startsWith("/items") },
  { href: "/traits", label: "시너지", match: (p: string) => p.startsWith("/traits") },
  { href: "/augments", label: "증강", match: (p: string) => p.startsWith("/augments") },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/95">
      <nav className="scrollbar-none fade-r mx-auto flex w-full max-w-3xl items-center gap-0.5 overflow-x-auto px-3 sm:px-4">
        <Link href="/" className="mr-2 flex shrink-0 items-center gap-2 sm:mr-4">
          <img src="/logo-128.png" alt="" className="size-7" />
          <span className="num hidden text-base uppercase tracking-wider text-text sm:inline">TFT Pick</span>
        </Link>
        {MENU.map((m) => {
          const active = m.match(path);
          return (
            <Link
              key={m.href}
              href={m.href}
              className={`shrink-0 border-b-2 px-2.5 py-2.5 text-sm transition-colors duration-150 ${
                active ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text"
              }`}
            >
              {m.label}
            </Link>
          );
        })}
        <span className="num ml-auto hidden rounded-md border border-line px-2 py-0.5 text-xs uppercase text-muted sm:inline">
          Set {meta.set} · {meta.patch}
        </span>
      </nav>
    </header>
  );
}
