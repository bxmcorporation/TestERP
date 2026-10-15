import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card } from '@/components/ui/PageHeader';
import { LoadingState, ErrorState } from '@/components/ui/Feedback';
import {
  Settings, Building2, Database, Info, Server, GitBranch, Layers,
  Users, GraduationCap, School, DoorOpen, CalendarClock, BookOpen,
  ClipboardCheck, Wallet, Activity, HardDrive, ShieldCheck, AlertCircle,
} from 'lucide-react';

type TableCount = { table: string; label: string; count: number; icon: typeof Users };

export function SettingsPage() {
  const [tableCounts, setTableCounts] = useState<TableCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tables: { table: string; label: string; icon: typeof Users }[] = [
        { table: 'units', label: 'Unidades', icon: Building2 },
        { table: 'courses', label: 'Cursos', icon: GraduationCap },
        { table: 'students', label: 'Alunos', icon: Users },
        { table: 'teachers', label: 'Professores', icon: School },
        { table: 'classes', label: 'Turmas', icon: School },
        { table: 'enrollments', label: 'Matrículas', icon: GraduationCap },
        { table: 'rooms', label: 'Salas', icon: DoorOpen },
        { table: 'schedules', label: 'Horários', icon: CalendarClock },
        { table: 'lessons', label: 'Aulas', icon: BookOpen },
        { table: 'attendance', label: 'Frequência', icon: ClipboardCheck },
        { table: 'financial_items', label: 'Lançamentos', icon: Wallet },
        { table: 'activities', label: 'Atividades', icon: Activity },
      ];

      const results = await Promise.all(
        tables.map(async (t) => {
          const { count, error } = await supabase
            .from(t.table)
            .select('*', { count: 'exact', head: true });
          return { ...t, count: error ? 0 : count || 0 };
        })
      );
      setTableCounts(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados do sistema');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRecords = tableCounts.reduce((sum, t) => sum + t.count, 0);

  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Informações do sistema e ambiente demonstrativo"
      />

      {/* Demo environment notice */}
      <Card className="mb-6 border-yellow-500/15">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Ambiente de Demonstração</h3>
            <p className="text-xs text-white/50 mt-1">
              Este é um ambiente demonstrativo do RAYON OS, o ERP educacional da RAYON Academy.
              Todos os dados exibidos são fictícios e utilizam um banco de dados Supabase de testes.
              As operações de CRUD funcionam normalmente, mas os dados podem ser redefinidos a qualquer momento.
            </p>
          </div>
        </div>
      </Card>

      {/* System info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Info size={18} className="text-white/50" />
            <h3 className="text-sm font-semibold text-white/80">Informações do Sistema</h3>
          </div>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b border-edge/subtle">
              <dt className="text-white/40 flex items-center gap-2">
                <Settings size={14} /> Sistema
              </dt>
              <dd className="text-white/80 font-medium">RAYON OS</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-edge/subtle">
              <dt className="text-white/40 flex items-center gap-2">
                <Layers size={14} /> Versão
              </dt>
              <dd className="text-white/80 font-mono text-xs">1.0.0-demonstracao</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-edge/subtle">
              <dt className="text-white/40 flex items-center gap-2">
                <Server size={14} /> Backend
              </dt>
              <dd className="text-white/80 text-xs">Supabase (PostgreSQL)</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-edge/subtle">
              <dt className="text-white/40 flex items-center gap-2">
                <GitBranch size={14} /> Stack
              </dt>
              <dd className="text-white/80 text-xs">React + TypeScript + Tailwind</dd>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-edge/subtle">
              <dt className="text-white/40 flex items-center gap-2">
                <ShieldCheck size={14} /> Ambiente
              </dt>
              <dd className="text-white/80">
                <span className="badge-base bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                  Demonstração
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-white/40 flex items-center gap-2">
                <HardDrive size={14} /> Banco de dados
              </dt>
              <dd className="text-white/80 text-xs">{totalRecords} registros</dd>
            </div>
          </dl>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={18} className="text-white/50" />
            <h3 className="text-sm font-semibold text-white/80">Informações da Organização</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center text-rayon-orange shrink-0">
                <GraduationCap size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">RAYON Academy</p>
                <p className="text-xs text-white/40 mt-0.5">
                  Plataforma de educação complementar focada no desenvolvimento de habilidades
                  essenciais para o século XXI.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-edge/subtle">
                <p className="text-xs text-white/40">Áreas de ensino</p>
                <p className="text-sm text-white/80 mt-1">6 programas</p>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-edge/subtle">
                <p className="text-xs text-white/40">Modalidade</p>
                <p className="text-sm text-white/80 mt-1">Presencial e Online</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-edge/subtle">
              <p className="text-xs text-white/40 mb-2">Programas disponíveis</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Comunicação e Oratória',
                  'Inteligência Emocional',
                  'Produtividade',
                  'IA e Tecnologia',
                  'Educação Financeira',
                  'Marca Pessoal',
                ].map((area) => (
                  <span
                    key={area}
                    className="badge-base bg-white/[0.04] text-white/60 border border-white/[0.06] text-xs"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Demo data info */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={18} className="text-white/50" />
          <h3 className="text-sm font-semibold text-white/80">Dados de Demonstração</h3>
        </div>
        <p className="text-xs text-white/40 mb-4">
          O ambiente demonstrativo contém dados fictícios para exploração de todas as funcionalidades
          do sistema. As contagens abaixo refletem o estado atual do banco de dados.
        </p>

        {loading ? (
          <LoadingState message="Contando registros..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <>
            {/* Total summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-4 rounded-xl bg-rayon-orange/5 border border-rayon-orange/10 text-center">
                <p className="text-3xl font-display font-bold text-rayon-orange">{totalRecords}</p>
                <p className="text-xs text-white/40 mt-1">Total de registros</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-edge/subtle text-center">
                <p className="text-3xl font-display font-bold text-white">{tableCounts.length}</p>
                <p className="text-xs text-white/40 mt-1">Tabelas ativas</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-edge/subtle text-center">
                <p className="text-3xl font-display font-bold text-white">
                  {tableCounts.filter((t) => t.count > 0).length}
                </p>
                <p className="text-xs text-white/40 mt-1">Com dados</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-edge/subtle text-center">
                <p className="text-3xl font-display font-bold text-white">
                  {tableCounts.filter((t) => t.count === 0).length}
                </p>
                <p className="text-xs text-white/40 mt-1">Vazias</p>
              </div>
            </div>

            {/* Table counts grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {tableCounts.map((tc) => {
                const Icon = tc.icon;
                const hasData = tc.count > 0;
                return (
                  <div
                    key={tc.table}
                    className={`p-3 rounded-lg border transition-all ${
                      hasData
                        ? 'bg-white/[0.02] border-edge/subtle'
                        : 'bg-white/[0.01] border-edge/subtle opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon size={16} className={hasData ? 'text-white/60' : 'text-white/30'} />
                      <span
                        className={`text-2xl font-display font-bold ${
                          hasData ? 'text-white' : 'text-white/30'
                        }`}
                      >
                        {tc.count}
                      </span>
                    </div>
                    <p className="text-xs text-white/50">{tc.label}</p>
                    <p className="text-xs text-white/20 font-mono mt-0.5">{tc.table}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* About section */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Info size={18} className="text-white/50" />
          <h3 className="text-sm font-semibold text-white/80">Sobre o RAYON OS</h3>
        </div>
        <div className="prose-sm text-sm text-white/60 space-y-3 max-w-none">
          <p>
            RAYON OS é o sistema de gestão educacional (ERP) desenvolvido para a RAYON Academy,
            uma plataforma de educação complementar que desenvolve habilidades essenciais
            em crianças, adolescentes e adultos.
          </p>
          <p>
            O sistema integra gestão de alunos, responsáveis, professores, turmas, matrículas,
            horários, aulas, frequência e finanças em uma única plataforma, com interface
            moderna e intuitiva em tema escuro.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <ShieldCheck size={14} className="text-green-400" />
              Dados protegidos com Row Level Security
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Database size={14} className="text-blue-400" />
              PostgreSQL via Supabase
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Server size={14} className="text-purple-400" />
              Edge Functions para lógica de servidor
            </div>
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Layers size={14} className="text-rayon-orange" />
              Arquitetura serverless
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
