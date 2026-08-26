"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/actions";
import StoreSwitcher from "@/app/components/StoreSwitcher";
import Logo from "@/app/components/Logo";
import type { Store, UserRole } from "@/lib/types";

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };

const ADMIN_LINKS: NavItem[] = [
  { href: "/dashboard", label: "홈" },
  {
    label: "상품관리",
    children: [
      { href: "/products/new", label: "상품 추가" },
      { href: "/products", label: "상품 조회" },
      { href: "/purchase-import", label: "매입 등록(쿠팡)" },
    ],
  },
  { href: "/stock-in", label: "입고" },
  { href: "/expiry", label: "소비기한 등록" },
  { href: "/sell", label: "판매" },
  { href: "/sales", label: "매출조회" },
  { href: "/coupons", label: "쿠폰관리" },
  { href: "/cash", label: "현금관리" },
  { href: "/kiosks", label: "키오스크 관리" },
  { href: "/staff", label: "직원관리" },
];

const STAFF_LINKS: NavItem[] = [
  { href: "/sell", label: "판매" },
  { href: "/stock-in", label: "입고" },
  { href: "/expiry", label: "소비기한 등록" },
  { href: "/cash", label: "현금관리" },
  { href: "/kiosks", label: "키오스크 관리" },
];

function isGroup(item: NavItem): item is { label: string; children: NavLink[] } {
  return "children" in item;
}

function NavGroup({
  item,
  pathname,
  onNavigate,
}: {
  item: { label: string; children: NavLink[] };
  pathname: string;
  onNavigate: () => void;
}) {
  const containsActive = item.children.some((c) => c.href === pathname);
  const [open, setOpen] = useState(containsActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-base text-zinc-600 hover:bg-zinc-100"
      >
        {item.label}
        <span className="text-zinc-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          {item.children.map((c) => {
            const active = pathname === c.href;
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={onNavigate}
                className={`rounded-md px-3 py-2 text-sm ${
                  active
                    ? "bg-[#C8075F] text-white"
                    : "text-zinc-500 hover:bg-zinc-100"
                }`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminShell({
  role,
  storeName,
  stores,
  currentStoreId,
  children,
}: {
  role: UserRole;
  storeName: string | null;
  stores: Store[];
  currentStoreId: string | null;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = role === "admin" ? ADMIN_LINKS : STAFF_LINKS;

  return (
    <div className="lg:flex lg:min-h-screen">
      {/* 모바일 상단바 */}
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="rounded p-1 text-zinc-600 hover:bg-zinc-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <Logo className="text-xs" />
          <span className="text-lg font-semibold text-zinc-900">
            {storeName ?? "무인편의점 관리"}
          </span>
        </div>
        <div className="w-6" />
      </div>

      {/* 모바일 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 transform flex-col border-r border-zinc-200 bg-white transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-zinc-200 px-4 py-6">
          <Logo className="text-sm" />
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {storeName ?? "무인편의점 관리"}
          </p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {links.map((item) => {
            if (isGroup(item)) {
              return (
                <NavGroup
                  key={item.label}
                  item={item}
                  pathname={pathname}
                  onNavigate={() => setOpen(false)}
                />
              );
            }
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-base ${
                  active
                    ? "bg-[#C8075F] text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {role === "admin" && (
          <div className="border-t border-zinc-200 px-3 py-4">
            <StoreSwitcher stores={stores} currentStoreId={currentStoreId} />
          </div>
        )}

        <div className="border-t border-zinc-200 px-3 py-4">
          <form action={signOut}>
            <button
              type="submit"
              className="w-full rounded-md px-3 py-2.5 text-left text-base text-zinc-500 hover:bg-zinc-100"
            >
              로그아웃
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
