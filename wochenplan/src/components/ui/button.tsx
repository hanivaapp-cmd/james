import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-soft",
  secondary: "bg-surface text-fg border border-border-strong/70 hover:bg-surface-2 hover:border-border-strong shadow-soft",
  soft: "bg-accent-soft text-accent hover:bg-accent/15",
  ghost: "text-muted hover:text-fg hover:bg-surface-3",
  danger: "bg-danger text-white hover:opacity-90 shadow-soft",
  "danger-ghost": "text-danger hover:bg-danger-soft",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-hover shadow-soft",
} as const;

const sizes = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg [&_svg]:size-4",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl [&_svg]:size-[18px]",
  lg: "h-14 px-5 text-base gap-2.5 rounded-xl [&_svg]:size-5",
  icon: "size-11 rounded-xl [&_svg]:size-5",
  "icon-sm": "size-9 rounded-lg [&_svg]:size-4",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors select-none",
        "disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
