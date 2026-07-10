import React, { useRef, useState } from "react";
import { cn } from "@/lib/cn";

/** สไลด์การ์ดทีละใบ + จุดไข่ปลาบอกตำแหน่ง */
export function Carousel({ children, className }: { children?: React.ReactNode; className?: string }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const onScroll = () => {
    const el = ref.current;
    if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  return (
    <div className={className}>
      <div
        ref={ref}
        onScroll={onScroll}
        className="flex overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {items.map((c, i) => (
          <div key={i} className="w-full shrink-0 px-5" style={{ scrollSnapAlign: "center" }}>
            {c}
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-[18px] bg-primary" : "w-1.5 bg-border")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
