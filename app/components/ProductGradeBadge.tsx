"use client";

import type { Product } from "../data/products";
import { useLanguage } from "../lib/language";
import { availableProductGrade, PRODUCT_GRADES } from "../lib/product-grades";

export default function ProductGradeBadge({ product }: { product: Product }) {
  const { text } = useLanguage();
  const grade = availableProductGrade(product);
  if (!grade) return null;

  const { label, color } = PRODUCT_GRADES[grade];
  return (
    <span className={`mb-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-tight sm:px-2 sm:py-1 sm:text-xs ${color}`}>
      {text(label)}
    </span>
  );
}
