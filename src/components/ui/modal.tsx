import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { X, Pencil, Trash2 } from "lucide-react";

/** Popup bottom-sheet: เด้งขึ้นตรงจากด้านล่าง + ลากพับลงเพื่อปิดได้ */
export function Modal({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [render, setRender] = useState(open);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);

  useEffect(() => {
    if (open) {
      setRender(true);
      setDragY(0);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    } else {
      setShown(false);
      const t = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!render) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [render, onClose]);

  if (!render) return null;

  const onDown = (e: React.PointerEvent) => {
    setDragging(true);
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onUp = () => {
    setDragging(false);
    if (dragY > 110) onClose();
    else setDragY(0);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div onClick={onClose} className="absolute inset-0 bg-black/50 transition-opacity duration-300" style={{ opacity: shown ? 1 : 0 }} />
      <div
        className="absolute inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col rounded-t-3xl bg-card shadow-xl"
        style={{
          maxHeight: "92vh",
          transform: shown ? `translateY(${dragY}px)` : "translateY(100%)",
          transition: dragging ? "none" : "transform .3s cubic-bezier(.32,.72,0,1)",
        }}
      >
        <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} className="shrink-0 cursor-grab touch-none px-6 pt-3 active:cursor-grabbing">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-border" />
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-disp text-lg font-bold text-foreground">{title}</div>
            <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/** แถวปุ่มไอคอน แก้ไข/ลบ สำหรับการ์ดรายละเอียด */
export function DetailActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      {onEdit && (
        <button onClick={onEdit} aria-label="แก้ไข" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="ลบ" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--destructive)/0.1)] text-destructive">
          <Trash2 size={18} />
        </button>
      )}
    </div>
  );
}

/** แถวข้อมูล label / value ในการ์ดรายละเอียด */
export function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <span className="shrink-0 text-[13px] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] font-medium text-foreground">{children}</span>
    </div>
  );
}
