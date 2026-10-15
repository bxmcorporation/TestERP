import { type ReactNode } from 'react';

export type PageHeaderAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'ghost';
};

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: PageHeaderAction[];
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-white text-balance">{title}</h1>
        {description && <p className="text-sm text-white/40 mt-1">{description}</p>}
      </div>
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={action.variant === 'ghost' ? 'btn-ghost' : 'btn-primary'}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide">{title}</h2>
      {description && <p className="text-xs text-white/40 mt-0.5">{description}</p>}
    </div>
  );
}

export function FormField({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-white/50 mb-1.5">
        {label}
        {required && <span className="text-rayon-orange ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-white/30 mt-1">{hint}</p>}
    </div>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`glass-card p-5 ${onClick ? 'cursor-pointer glass-hover' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
