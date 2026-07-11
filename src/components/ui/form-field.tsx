import * as React from "react";
import { Label } from "./label";

/** ช่องกรอกมาตรฐาน: label ด้านบน + control + ข้อความช่วย/ผิดพลาด */
export function FormField({ label, hint, error, children, className }: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? "mb-4"}>
      {label && <Label>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
