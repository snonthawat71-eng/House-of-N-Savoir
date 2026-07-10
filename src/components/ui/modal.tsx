import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** Popup แบบ bottom-sheet (เด้งขึ้นจากล่าง) ใช้กับฟอร์มและการ์ดรายละเอียด */
export function Modal({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "fixed bottom-0 left-1/2 z-50 flex max-h-[92vh] w-full max-w-md -translate-x-1/2 flex-col rounded-t-3xl bg-card shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom"
          )}
        >
          <div className="shrink-0 px-5 pt-3">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-1 flex items-center justify-between">
              <Dialog.Title className="font-disp text-lg font-bold text-foreground">{title}</Dialog.Title>
              <Dialog.Close className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <X size={16} />
              </Dialog.Close>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-2">{children}</div>
          {footer && <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** แถวปุ่มไอคอน แก้ไข/ลบ สำหรับการ์ดรายละเอียด */
export function DetailActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <div className="mt-5 flex justify-end gap-2">
      {onEdit && (
        <button onClick={onEdit} aria-label="แก้ไข"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-foreground">
          <Pencil size={18} />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} aria-label="ลบ"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[hsl(var(--primary)/0.1)] text-primary">
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
