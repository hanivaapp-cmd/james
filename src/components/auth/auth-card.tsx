import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description ? <p className="mt-1.5 text-sm text-muted">{description}</p> : null}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">{children}</div>
      {footer ? <div className="mt-5 text-center text-[13px] text-muted">{footer}</div> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
      {message}
    </p>
  );
}
