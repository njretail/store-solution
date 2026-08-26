import Link from "next/link";
import { signOut } from "@/lib/actions";
import type { UserRole } from "@/lib/types";

export default function NavBar({
  role,
  storeName,
}: {
  role: UserRole;
  storeName: string | null;
}) {
  const links =
    role === "admin"
      ? [
          { href: "/products", label: "상품관리" },
          { href: "/stock-in", label: "입고" },
          { href: "/sell", label: "판매" },
          { href: "/sales", label: "매출조회" },
        ]
      : [
          { href: "/sell", label: "판매" },
          { href: "/stock-in", label: "입고" },
        ];

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
      <div className="flex items-center gap-6">
        <span className="text-sm font-semibold text-zinc-900">
          {storeName ?? "무인편의점 관리"}
        </span>
        <nav className="flex gap-4 text-sm text-zinc-600">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-zinc-900">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          로그아웃
        </button>
      </form>
    </header>
  );
}
