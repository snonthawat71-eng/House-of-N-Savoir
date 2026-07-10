import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// รวม class ของ Tailwind แบบไม่ชนกัน (ใช้กับคอมโพเนนต์ shadcn/ui)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
