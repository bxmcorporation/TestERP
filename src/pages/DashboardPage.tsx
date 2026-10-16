import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader, Card } from '@/components/ui/PageHeader';
import { LoadingState, ErrorState, StatusBadge } from '@/components/ui/Feedback';
import {
  Users, GraduationCap, School, ClipboardList, BookOpen, Wallet,
  TrendingUp, AlertCircle, ArrowRight, Clock, UserPlus,
} from 'lucide-react';
import type { Activity, Class, Enrollment, Lesson, Student } from '@/lib/types';

type DashboardData = {
  totalStudents: number;
  activeStudents: number;
  totalEnrollments: number;
  waitingEnrollments: number;
  totalClasses: number;
  formingClasses: number;
  activeClasses: number;
  totalTeachers: number;
  scheduledLessons: number;
  openFinancialItems: number;
  overdueFinancialItems: number;
};

type RecentActivity = Activity & {
  age: string;
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const activityIcons: Record<string, React.ReactNode> = {
  student: <UserPlus size={14} />,
  enrollment: <ClipboardList size={14} />,
  class: <School size={14} />,
  teacher: <GraduationCap size={14} />,
  financial: <Wallet size={14} />,
  lesson: <BookOpen size={14} />,
};

export function DashboardPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [upcomingLessons, setUpcomingLessons] = useState<(Lesson & { class_name?: string })[]>([]);
  const [recentEnrollments, setRecentEnrollments] = useState<(Enrollment & { student_name?: string; course_name?: string })[]>([]);
  const [formingClasses, setFormingClasses] = useState<(Class & { course_name?: string; occupied?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        studentsRes, activeStudentsRes, enrollmentsRes, waitingEnrollRes,
        classesRes, formingClassesRes, activeClassesRes, teachersRes,
        lessonsRes, openFinancialRes, overdueFinancialRes,
        activitiesRes, upcomingLessonsRes, recentEnrollRes,
      ] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }),
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('status', 'ativo'),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }),
        supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('status', 'aguardando_turma'),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('status', 'em_formacao'),
        supabase.from('classes').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
        supabase.from('teachers').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }).eq('status', 'agendada'),
        supabase.from('financial_items').select('*', { count: 'exact', head: true }).eq('status', 'em_aberto'),
        supabase.from('financial_items').select('*', { count: 'exact', head: true }).eq('status', 'vencido'),
        supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('lessons').select('*, class:classes(name)').gte('lesson_date', new Date().toISOString().split('T')[0]).eq('status', 'agendada').order('lesson_date', { ascending: true }).limit(5),
        supabase.from('enrollments').select('*, student:students(first_name,last_name), course:courses(name)').order('created_at', { ascending: false }).limit(5),
      ]);

      setData({
        totalStudents: studentsRes.count || 0,
        activeStudents: activeStudentsRes.count || 0,
        totalEnrollments: enrollmentsRes.count || 0,
        waitingEnrollments: waitingEnrollRes.count || 0,
        totalClasses: classesRes.count || 0,
        formingClasses: formingClassesRes.count || 0,
        activeClasses: activeClassesRes.count || 0,
        totalTeachers: teachersRes.count || 0,
        scheduledLessons: lessonsRes.count || 0,
        openFinancialItems: openFinancialRes.count || 0,
        overdueFinancialItems: overdueFinancialRes.count || 0,
      });

      setActivities(
        (activitiesRes.data || []).map((a: Activity) => ({
          ...a,
          age: timeAgo(a.created_at),
        }))
      );

      setUpcomingLessons(
        (upcomingLessonsRes.data || []).map((l: Lesson & { class?: { name: string } }) => ({
          ...l,
          class_name: l.class?.name,
        }))
      );

      setRecentEnrollments(
        (recentEnrollRes.data || []).map((e: Enrollment & { student?: { first_name: string; last_name: string }; course?: { name: string } }) => ({
          ...e,
          student_name: e.student ? `${e.student.first_name} ${e.student.last_name}` : undefined,
          course_name: e.course?.name,
        }))
      );

      // Load forming classes with occupancy
      if (formingClassesRes.count && formingClassesRes.count > 0) {
        const { data: formingData } = await supabase
          .from('classes')
          .select('*, course:courses(name), class_students(count)')
          .eq('status', 'em_formacao');
        
        if (formingData) {
          const enriched = await Promise.all(
            (formingData as (Class & { course?: { name: string }; class_students?: { count: number }[] })[]).map(async (c) => {
              const { count } = await supabase
                .from('class_students')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', c.id);
              return {
                ...c,
                course_name: c.course?.name,
                occupied: count || 0,
              };
            })
          );
          setFormingClasses(enriched);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) return <LoadingState message="Carregando dashboard..." />;
  if (error || !data) return <ErrorState message={error || 'Erro desconhecido'} onRetry={loadDashboard} />;

  const metrics = [
    { label: 'Total de Alunos', value: data.totalStudents, icon: <Users size={20} />, path: '/students', accent: true },
    { label: 'Alunos Ativos', value: data.activeStudents, icon: <Users size={20} />, path: '/students' },
    { label: 'Matriculas', value: data.totalEnrollments, icon: <ClipboardList size={20} />, path: '/enrollments' },
    { label: 'Aguardando Turma', value: data.waitingEnrollments, icon: <Clock size={20} />, path: '/enrollments', highlight: data.waitingEnrollments > 0 },
    { label: 'Turmas', value: data.totalClasses, icon: <School size={20} />, path: '/classes' },
    { label: 'Em Formacao', value: data.formingClasses, icon: <School size={20} />, path: '/classes', highlight: data.formingClasses > 0 },
    { label: 'Turmas Ativas', value: data.activeClasses, icon: <School size={20} />, path: '/classes' },
    { label: 'Professores', value: data.totalTeachers, icon: <GraduationCap size={20} />, path: '/teachers' },
    { label: 'Aulas Agendadas', value: data.scheduledLessons, icon: <BookOpen size={20} />, path: '/lessons' },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Visao geral da operacao educacional RAYON Academy"
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={() => onNavigate(m.path)}
            className={`glass-card glass-hover p-4 text-left group ${m.highlight ? 'border-yellow-500/20' : ''}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${m.accent ? 'bg-rayon-orange/10 text-rayon-orange border border-rayon-orange/20' : 'bg-gray-100 text-gray-400'}`}>
                {m.icon}
              </div>
              {m.highlight && (
                <AlertCircle size={14} className="text-yellow-600" />
              )}
            </div>
            <p className="text-2xl font-display font-bold text-gray-900">{m.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Financial Alert */}
      {(data.openFinancialItems > 0 || data.overdueFinancialItems > 0) && (
        <Card className="mb-6 border-yellow-500/15">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600">
              <Wallet size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Pendencias Financeiras</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {data.openFinancialItems} cobrancas em aberto
                {data.overdueFinancialItems > 0 && ` · ${data.overdueFinancialItems} vencidas`}
              </p>
            </div>
            <button onClick={() => onNavigate('/financial')} className="btn-ghost text-xs">
              Ver financeiro
              <ArrowRight size={14} />
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Activities */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Atividades Recentes</h3>
            <TrendingUp size={16} className="text-gray-300" />
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-300 py-8 text-center">Nenhuma atividade registrada</p>
          ) : (
            <div className="space-y-2">
              {activities.map((act) => (
                <div key={act.id} className="flex items-start gap-3 py-2 border-b border-edge/subtle last:border-0">
                  <div className="p-1.5 rounded-md bg-gray-100 text-gray-400 mt-0.5">
                    {activityIcons[act.type] || <AlertCircle size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{act.title}</p>
                    {act.description && <p className="text-xs text-gray-400 truncate">{act.description}</p>}
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">{act.age}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Upcoming Lessons */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Proximas Aulas</h3>
            <BookOpen size={16} className="text-gray-300" />
          </div>
          {upcomingLessons.length === 0 ? (
            <p className="text-sm text-gray-300 py-8 text-center">Nenhuma aula agendada</p>
          ) : (
            <div className="space-y-2">
              {upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center gap-3 py-2 border-b border-edge/subtle last:border-0">
                  <div className="text-center shrink-0">
                    <p className="text-xs text-gray-300">
                      {new Date(lesson.lesson_date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </p>
                    <p className="text-xs text-rayon-orange font-medium">
                      {lesson.start_time.slice(0, 5)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{lesson.title}</p>
                    <p className="text-xs text-gray-400 truncate">{lesson.class_name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Forming Classes */}
      {formingClasses.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Turmas em Formacao</h3>
            <button onClick={() => onNavigate('/classes')} className="text-xs text-rayon-orange hover:underline">
              Ver todas
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {formingClasses.map((cls) => {
              const pct = cls.max_capacity ? (cls.occupied || 0) / cls.max_capacity * 100 : 0;
              return (
                <div key={cls.id} className="p-4 rounded-lg bg-gray-50 border border-edge">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">{cls.name}</p>
                    <StatusBadge status={cls.status} />
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{cls.course_name}</p>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-gray-400">{cls.occupied || 0} / {cls.max_capacity} alunos</span>
                    <span className="text-gray-300">Min: {cls.min_capacity}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : pct >= (cls.min_capacity / cls.max_capacity * 100) ? 'bg-green-500' : 'bg-rayon-orange'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recent Enrollments */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Matriculas Recentes</h3>
          <button onClick={() => onNavigate('/enrollments')} className="text-xs text-rayon-orange hover:underline">
            Ver todas
          </button>
        </div>
        {recentEnrollments.length === 0 ? (
          <p className="text-sm text-gray-300 py-8 text-center">Nenhuma matricula recente</p>
        ) : (
          <div className="space-y-2">
            {recentEnrollments.map((enr) => (
              <div key={enr.id} className="flex items-center gap-3 py-2 border-b border-edge/subtle last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{enr.student_name}</p>
                  <p className="text-xs text-gray-400 truncate">{enr.course_name}</p>
                </div>
                <span className="text-xs text-gray-300 shrink-0">
                  {new Date(enr.enrollment_date).toLocaleDateString('pt-BR')}
                </span>
                <StatusBadge status={enr.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
