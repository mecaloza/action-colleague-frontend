"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** A row that scrolls sideways when it doesn't fit (a phone): a fade at its end says there is more to see. */
export function ScrollRow({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const row = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    const node = row.current;
    if (!node) return;
    const update = () => setMore(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => {
      node.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="relative min-w-0">
      <div ref={row} className={cn("scrollbar-thin flex overflow-x-auto", className)} {...props}>
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background transition-opacity",
          more ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
