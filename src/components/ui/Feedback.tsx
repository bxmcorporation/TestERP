import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info' | 'orange';

const variantStyles: Record<BadgeVariant, string> = {
  neutral: 'bg-white/[0.06] text-white/60 border border-white/[0.08]',
  success: 'bg-green-500/10 text-green-400 border border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  error: 'bg-red-500/10 text-red-400 border border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  orange: 'bg-rayon-orange/10 text-rayon-orange-400 border border-rayon-orange/20',
};

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span className={`badge-base ${variantStyles[variant]}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, BadgeVariant> = {
    ativo: 'success',
    inativo: 'neutral',
    pendente: 'warning',
    aguardando_turma: 'warning',
    aguardando: 'warning',
    ativa: 'success',
    suspensa: 'error',
    cancelada: 'error',
    cancelado: 'error',
    concluida: 'info',
    concluido: 'info',
    em_aberto: 'warning',
    pago: 'success',
    vencido: 'error',
    planejamento: 'neutral',
    em_formacao: 'warning',
    confirmada: 'info',
    em_andamento: 'success',
    agendada: 'neutral',
    realizada: 'success',
    presente: 'success',
    ausente: 'error',
    justificado: 'warning',
    nao_matriculado: 'neutral',
  };

  const labelMap: Record<string, string> = {
    aguardando_turma: 'Aguardando turma',
    em_formacao: 'Em formacao',
    em_andamento: 'Em andamento',
    em_aberto: 'Em aberto',
    nao_matriculado: 'Nao matriculado',
  };

  const variant = statusMap[status] || 'neutral';
  const label = labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

  return <Badge variant={variant}>{label}</Badge>;
}

export function Spinner({ size = 20 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin text-rayon-orange" />;
}

export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size={28} />
      <p className="text-sm text-white/40">{message}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 p-3 rounded-2xl bg-white/[0.03] border border-edge text-white/30">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white/70">{title}</h3>
      {description && <p className="text-sm text-white/40 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M4.93 19h14.14a2 2 0 001.74-3l-7.07-12a2 2 0 00-3.48 0l-7.07 12a2 2 0 001.74 3z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-white/70">Erro ao carregar</h3>
      <p className="text-sm text-white/40 mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-ghost mt-4">
          Tentar novamente
        </button>
      )}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse-soft rounded-lg bg-white/[0.04] ${className}`} />
  );
}
