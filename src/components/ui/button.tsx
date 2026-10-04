import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover shadow-soft",
  secondary: "bg-surface text-fg border border-border hover:bg-surface-2 shadow-soft",
  ghost: "text-muted hover:text-fg hover:bg-surface-2",
  danger: "bg-danger text-white hover:opacity-90 shadow-soft",
  "danger-ghost": "text-danger hover:bg-danger-soft",
} as const;

const sizes = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-4 text-[15px] gap-2 rounded-lg",
  icon: "h-9 w-9 rounded-lg",
  "icon-sm": "h-8 w-8 rounded-md",
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
        "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-colors select-none",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
