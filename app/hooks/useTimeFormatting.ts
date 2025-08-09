"use client";

export function useTimeFormatting(locale: string = "ru-RU") {
  const formatHourLocal = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDateLocal = (iso: string | number | Date): string => {
    const d = new Date(iso);
    return d.toLocaleDateString(locale);
  };

  return { formatHourLocal, formatDateLocal };
}


