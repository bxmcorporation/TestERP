import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card } from '@/components/ui/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/Feedback';
import {
  BarChart3, Users, GraduationCap, School, Wallet, ClipboardCheck, TrendingUp,
  TrendingDown, DollarSign, Calendar, ArrowRight, Activity,
} from 'lucide-react';

type ReportStats = {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalCourses: number;
  totalUnits: number;
  enrollmentsByStatus: Record<string, number>;
  classesByStatus: Record<string, number>;
  totalReceita: number;
  totalDespesa: number;
  emAberto: number;
  vencido: number;
  attendancePresent: number;
  attendanceTotal: number;
  totalLessons: number;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function ReportsPage({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        studentsRes, teachersRes, classesRes, coursesRes, unitsRes,
        enrollmentsRes, financialRes, attendanceRes, lessonsRes,
      ] = await Promise.all([
        supabase.from('students').select('status', { count: 'exact' }),
        supabase.from('teachers').select('status', { count: 'exact' }),
        supabase.from('classes').select('status'),
        supabase.from('courses').select('id', { count: 'exact', head: true }),
        supabase.from('units').select('id', { count: 'exact', head: true }),
        supabase.from('enrollments').select('status'),
        supabase.from('financial_items').select('type, status, amount'),
        supabase.from('attendance').select('status'),
        supabase.from('lessons').select('id', { count: 'exact', head: true }),
      ]);

      const studentsData = (studentsRes.data || []) as { status: string }[];
      const enrollmentsData = (enrollmentsRes.data || []) as { status: string }[];
      const classesData = (classesRes.data || []) as { status: string }[];
      const financialData = (financialRes.data || []) as { type: string; status: string; amount: number }[];
      const attendanceData = (attendanceRes.data || []) as { status: string }[];

      const enrollmentsByStatus: Record<string, number> = {};
      enrollmentsData.forEach((e) => {
        enrollmentsByStatus[e.status] = (enrollmentsByStatus[e.status] || 0) + 1;
      });

      const classesByStatus: Record<string, number> = {};
      classesData.forEach((c) => {
        classesByStatus[c.status] = (classesByStatus[c.status] || 0) + 1;
      });

      const totalReceita = financialData
        .filter((f) => f.type === 'receita' && f.status === 'pago')
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const totalDespesa = financialData
        .filter((f) => f.type === 'despesa' && f.status === 'pago')
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const emAberto = financialData
        .filter((f) => f.type === 'receita' && f.status === 'em_aberto')
        .reduce((sum, f) => sum + Number(f.amount), 0);
      const vencido = financialData
        .filter((f) => f.type === 'receita' && f.status === 'vencido')
        .reduce((sum, f) => sum + Number(f.amount), 0);

      const attendancePresent = attendanceData.filter((a) => a.status === 'presente').length;
      const attendanceTotal = attendanceData.length;

      setStats({
        totalStudents: studentsRes.count || 0,
        activeStudents: studentsData.filter((s) => s.status === 'ativo').length,
        totalTeachers: teachersRes.count || 0,
        totalClasses: classesData.length,
        totalCourses: coursesRes.count || 0,
        totalUnits: unitsRes.count || 0,
        enrollmentsByStatus,
        classesByStatus,
        totalReceita,
        totalDespesa,
        emAberto,
        vencido,
        attendancePresent,
        attendanceTotal,
        totalLessons: lessonsRes.count || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reportCards = [
    {
      title: 'Relatório de Alunos',
      description: 'Dados cadastrais, matrículas e situação acadêmica',
      icon: Users,
      color: 'text-rayon-orange',
      bg: 'bg-rayon-orange/10 border-rayon-orange/20',
      path: '/students',
    },
    {
      title: 'Relatório de Matrículas',
      description: 'Matrículas por curso e status',
      icon: GraduationCap,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10 border-blue-500/20',
      path: '/enrollments',
    },
    {
      title: 'Relatório de Turmas',
      description: 'Turmas, ocupação e desempenho',
      icon: School,
      color: 'text-green-600',
      bg: 'bg-green-500/10 border-green-500/20',
      path: '/courses',
    },
    {
      title: 'Relatório Financeiro',
      description: 'Receitas, despesas e inadimplência',
      icon: Wallet,
      color: 'text-yellow-600',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      path: '/financial',
    },
    {
      title: 'Relatório de Frequência',
      description: 'Presença e ausência por turma',
      icon: ClipboardCheck,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      path: '/attendance',
    },
    {
      title: 'Relatório de Aulas',
      description: 'Aulas ministradas e planejadas',
      icon: Calendar,
      color: 'text-pink-400',
      bg: 'bg-pink-500/10 border-pink-500/20',
      path: '/lessons',
    },
  ];

  const attendanceRate = stats && stats.attendanceTotal > 0
    ? Math.round((stats.attendancePresent / stats.attendanceTotal) * 100)
    : 0;

  if (loading) {
    return (
      <div>
        <PageHeader title="Relatórios" description="Visão geral e indicadores da RAYON Academy" />
        <Card>
          <LoadingState message="Carregando indicadores..." />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Relatórios" description="Visão geral e indicadores da RAYON Academy" />
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Visão geral e indicadores da RAYON Academy"
      />

      {/* Summary metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="text-center">
          <div className="inline-flex p-2.5 rounded-xl bg-rayon-orange/10 border border-rayon-orange/20 text-rayon-orange mb-3">
            <Users size={20} />
          </div>
          <p className="text-3xl font-display font-bold text-gray-900">{stats.totalStudents}</p>
          <p className="text-xs text-gray-400 mt-1">Alunos cadastrados</p>
          <p className="text-xs text-green-600 mt-1">{stats.activeStudents} ativos</p>
        </Card>

        <Card className="text-center">
          <div className="inline-flex p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 mb-3">
            <GraduationCap size={20} />
          </div>
          <p className="text-3xl font-display font-bold text-gray-900">{stats.totalTeachers}</p>
          <p className="text-xs text-gray-400 mt-1">Professores</p>
          <p className="text-xs text-gray-300 mt-1">{stats.totalCourses} cursos</p>
        </Card>

        <Card className="text-center">
          <div className="inline-flex p-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-600 mb-3">
            <School size={20} />
          </div>
          <p className="text-3xl font-display font-bold text-gray-900">{stats.totalClasses}</p>
          <p className="text-xs text-gray-400 mt-1">Turmas</p>
          <p className="text-xs text-gray-300 mt-1">{stats.totalUnits} unidades</p>
        </Card>

        <Card className="text-center">
          <div className="inline-flex p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mb-3">
            <ClipboardCheck size={20} />
          </div>
          <p className="text-3xl font-display font-bold text-gray-900">{attendanceRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Taxa de frequência</p>
          <p className="text-xs text-gray-300 mt-1">{stats.totalLessons} aulas</p>
        </Card>
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Resumo Financeiro</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className="text-green-600" />
                <span className="text-sm text-gray-600">Receitas</span>
              </div>
              <span className="text-sm font-medium text-green-600">{formatBRL(stats.totalReceita)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <div className="flex items-center gap-2.5">
                <TrendingDown size={16} className="text-red-600" />
                <span className="text-sm text-gray-600">Despesas</span>
              </div>
              <span className="text-sm font-medium text-red-600">{formatBRL(stats.totalDespesa)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <div className="flex items-center gap-2.5">
                <DollarSign size={16} className="text-yellow-600" />
                <span className="text-sm text-gray-600">Em aberto</span>
              </div>
              <span className="text-sm font-medium text-yellow-600">{formatBRL(stats.emAberto)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-rayon-orange/5 border border-rayon-orange/10">
              <div className="flex items-center gap-2.5">
                <Activity size={16} className="text-rayon-orange" />
                <span className="text-sm text-gray-600">Saldo</span>
              </div>
              <span className={`text-sm font-medium ${stats.totalReceita - stats.totalDespesa >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatBRL(stats.totalReceita - stats.totalDespesa)}
              </span>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Situação das Turmas</h3>
          </div>
          {Object.keys(stats.classesByStatus).length === 0 ? (
            <EmptyState icon={<School size={24} />} title="Sem dados" description="Nenhuma turma cadastrada" />
          ) : (
            <div className="space-y-2.5">
              {Object.entries(stats.classesByStatus).map(([status, count]) => {
                const pct = stats.totalClasses > 0 ? (count / stats.totalClasses) * 100 : 0;
                const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-gray-400">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rayon-orange transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Enrollments by status */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <GraduationCap size={18} className="text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-700">Matrículas por Situação</h3>
        </div>
        {Object.keys(stats.enrollmentsByStatus).length === 0 ? (
          <EmptyState icon={<GraduationCap size={24} />} title="Sem dados" description="Nenhuma matrícula" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(stats.enrollmentsByStatus).map(([status, count]) => {
              const label = status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
              return (
                <div key={status} className="p-3 rounded-lg bg-gray-50 border border-edge/subtle text-center">
                  <p className="text-2xl font-display font-bold text-gray-900">{count}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Report type cards */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Relatórios Detalhados
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCards.map((rc) => {
            const Icon = rc.icon;
            return (
              <Card
                key={rc.title}
                onClick={() => onNavigate?.(rc.path)}
                className="group"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${rc.bg} ${rc.color} shrink-0`}>
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 transition-colors">
                      {rc.title}
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">{rc.description}</p>
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all"
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
