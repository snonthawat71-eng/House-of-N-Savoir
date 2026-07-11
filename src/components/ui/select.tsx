import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

/** Select แบบ native (สไตล์เดียวกับ Input) */
const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-border bg-transparent px-4 pr-10 text-sm text-foreground outline-none transition-colors",
          "focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
);
Select.displayName = "Select";

export { Select };
