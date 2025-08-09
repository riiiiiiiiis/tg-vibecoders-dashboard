"use client";

export function useNumberFormatter(locale: string = "ru-RU") {
  const formatter = new Intl.NumberFormat(locale);
  const formatNumber = (value: number | bigint | null | undefined): string => {
    const n = typeof value === "bigint" ? Number(value) : value ?? 0;
    return formatter.format(n);
  };
  return { formatNumber };
}


