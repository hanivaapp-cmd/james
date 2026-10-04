import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/login">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-[8vh] pb-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
