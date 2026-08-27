"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { updateProduct, deleteProduct, type ProductFormState } from "../actions";
import type { Category, Product } from "@/lib/types";

const initialState: ProductFormState = { error: null, success: null };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500">{label}</label>
      {children}
    </div>
  );
}

export default function EditProductForm({
  product,
  categories,
}: {
  product: Product;
  categories: Category[];
}) {
  const [state, formAction, pending] = useActionState(updateProduct, initialState);
  const [preview, setPreview] = useState<string | null>(product.image_url);

  const inputClass = "w-full rounded border border-zinc-300 px-3 py-2 text-base";

  return (
    <div className="max-w-md rounded-lg border border-zinc-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/products" className="text-sm text-zinc-500 hover:text-zinc-700">
          ← 상품 조회로 돌아가기
        </Link>
        <form
          action={deleteProduct}
          onSubmit={(e) => {
            if (!confirm(`"${product.name}" 상품을 삭제할까요?`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="id" value={product.id} />
          <button type="submit" className="text-sm text-red-500 hover:text-red-700">
            삭제
          </button>
        </form>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={product.id} />

        <Field label="바코드">
          <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-base text-zinc-500">
            {product.barcode}
          </p>
        </Field>

        <Field label="상품 이미지">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
              {preview ? (
                <Image
                  src={preview}
                  alt={product.name}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xs text-zinc-300">사진 없음</span>
              )}
            </div>
            <input
              name="image"
              type="file"
              accept="image/*"
              className="text-sm text-zinc-600"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPreview(URL.createObjectURL(file));
              }}
            />
          </div>
        </Field>

        <Field label="상품명">
          <input name="name" defaultValue={product.name} required className={inputClass} />
        </Field>

        <Field label="카테고리">
          <select
            name="category_id"
            defaultValue={product.category_id ?? ""}
            className={inputClass}
          >
            <option value="">분류 없음</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="과세여부">
          <select
            name="is_tax_exempt"
            defaultValue={String(product.is_tax_exempt)}
            className={inputClass}
          >
            <option value="false">과세</option>
            <option value="true">면세</option>
          </select>
        </Field>

        <Field label="입고가 (원가)">
          <input
            name="cost_price"
            type="number"
            defaultValue={product.cost_price}
            className={inputClass}
          />
        </Field>

        <Field label="판매가">
          <input
            name="sell_price"
            type="number"
            defaultValue={product.sell_price}
            className={inputClass}
          />
        </Field>

        <Field label="재고부족 기준">
          <input
            name="low_stock_threshold"
            type="number"
            defaultValue={product.low_stock_threshold}
            className={inputClass}
          />
        </Field>

        <Field label="현재 재고">
          <p className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-base text-zinc-500">
            {product.stock_qty}개 — 재고 수량은 입고/판매 화면에서 반영됩니다.
          </p>
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[#C8075F] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#a80650] disabled:opacity-50"
        >
          {pending ? "저장 중..." : "저장"}
        </button>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.success && <p className="text-sm text-green-600">{state.success}</p>}
      </form>
    </div>
  );
}
