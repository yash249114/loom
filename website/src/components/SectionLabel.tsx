import type { ReactNode } from "react";

interface SectionLabelProps {
  number?: string;
  label: string;
  children?: ReactNode;
  className?: string;
}

export function SectionLabel({
  number,
  label,
  children,
  className = "",
}: SectionLabelProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-baseline gap-3 border-b section-rule pb-3">
        {number && (
          <span className="label-sm text-accent" aria-hidden="true">
            {number}
          </span>
        )}
        <span className="label">{label}</span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
