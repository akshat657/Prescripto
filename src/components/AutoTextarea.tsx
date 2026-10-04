"use client";

import { useLayoutEffect, useRef } from "react";

// Grows with its content so the doctor never scrolls inside a tiny box.
export function AutoTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return <textarea ref={ref} rows={1} {...props} className={`field resize-none overflow-hidden leading-relaxed ${props.className ?? ""}`} />;
}
