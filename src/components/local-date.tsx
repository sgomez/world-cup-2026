"use client";

import { useEffect, useState } from "react";

export function LocalDate({ date }: { date: Date }) {
  const [formatted, setFormatted] = useState<string>("");

  useEffect(() => {
    const localStr = date.toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    });
    const utcStr =
      date.toISOString().replace("T", " ").substring(0, 16) + " UTC";
    setFormatted(`${localStr} (${utcStr})`);
  }, [date]);

  if (!formatted) {
    const utcStr =
      date.toISOString().replace("T", " ").substring(0, 16) + " UTC";
    return <span>{utcStr}</span>;
  }

  return <span>{formatted}</span>;
}
