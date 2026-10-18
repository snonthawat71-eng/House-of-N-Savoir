import type { ReactNode } from "react";

/** ช่องกรอกในฟอร์ม: หัวข้อตัวเล็กสีเทา + ตัวช่องด้านล่าง (มาตรฐานเดียวทั้งแอป) */
export function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
