import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import {
  ClipboardList, Plus, Search, Pencil, Clock, Save, X,
} from 'lucide-react';
import type { Enrollment, Student, Course, Unit } from '@/lib/types';

type EnrollmentWithRelations = Enrollment & {
  student?: Student;
  course?: Course;
  unit?: Unit;
};

const STATUS_OPTIONS = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'aguardando_turma', label: 'Aguardando Turma' },
  { value: 'ativa', label: 'Ativa' },
  { value: 'suspensa', label: 'Suspensa' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'concluida', label: 'Concluida' },
];

export function EnrollmentsPage({ initialSearch }: { initialSearch?: string }) {
  const [enrollments, setEnrollments] = useState<EnrollmentWithRelations[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEnrollment, setEditingEnrollment] = useState<EnrollmentWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select('*, student:students(*), course:courses(*), unit:units(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEnrollments((data || []) as EnrollmentWithRelations[]);

      const [sRes, cRes, uRes] = await Promise.all([
        supabase.from('students').select('*').order('first_name'),
        supabase.from('courses').select('*').eq('status', 'ativo').order('name'),
        supabase.from('units').select('*').order('name'),
      ]);
      setStudents((sRes.data || []) as Student[]);
      setCourses((cRes.data || []) as Course[]);
      setUnits((uRes.data || []) as Unit[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar matriculas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);

  const filtered = enrollments.filter((e) => {
    const studentName = e.student ? `${e.student.first_name} ${e.student.last_name}`.toLowerCase() : '';
    const matchesSearch = !search || studentName.includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async (formData: Partial<Enrollment>) => {
    try {
      if (editingEnrollment) {
        const { id } = editingEnrollment;
        const { error } = await supabase.from('enrollments').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await logActivity('enrollment', 'Matricula atualizada', eStudentName(editingEnrollment), 'enrollment', id);
      } else {
        const newCode = await generateCode('MAT', 'enrollments');
        const { data, error } = await supabase
          .from('enrollments')
          .insert({ ...formData, code: newCode })
          .select()
          .single();
        if (error) throw error;
        await logActivity('enrollment', 'Matricula criada', `Codigo ${newCode}`, 'enrollment', data.id);
      }
      setModalOpen(false);
      setEditingEnrollment(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar', 'error');
    }
  };

  const handleStatusChange = async (enrollment: EnrollmentWithRelations, newStatus: string) => {
    try {
      const { error } = await supabase.from('enrollments').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', enrollment.id);
      if (error) throw error;
      await logActivity('enrollment', 'Status de matricula alterado', `${eStudentName(enrollment)}: ${newStatus}`, 'enrollment', enrollment.id);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao atualizar status', 'error');
    }
  };

  const columns: Column<EnrollmentWithRelations>[] = [
    { key: 'code', label: 'Codigo', render: (e) => <span className="text-xs text-gray-400 font-mono">{e.code}</span> },
    {
      key: 'student',
      label: 'Aluno',
      render: (e) => e.student ? (
        <span className="text-gray-800 font-medium">{e.student.first_name} {e.student.last_name}</span>
      ) : <span className="text-gray-300">—</span>,
    },
    {
      key: 'course',
      label: 'Curso',
      render: (e) => <span className="text-gray-500">{e.course?.name || '—'}</span>,
    },
    {
      key: 'enrollment_date',
      label: 'Data',
      render: (e) => <span className="text-gray-400 text-xs">{new Date(e.enrollment_date).toLocaleDateString('pt-BR')}</span>,
    },
    {
      key: 'status',
      label: 'Situacao',
      render: (e) => <StatusBadge status={e.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Matriculas"
        description="Acompanhe o ciclo de vida das matriculas"
        actions={[
          { label: 'Nova Matricula', icon: <Plus size={16} />, onClick: () => { setEditingEnrollment(null); setModalOpen(true); } },
        ]}
      />

      {/* Waiting for class highlight */}
      {enrollments.filter((e) => e.status === 'aguardando_turma').length > 0 && (
        <Card className="mb-4 border-yellow-500/15">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600">
              <Clock size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Alunos Aguardando Turma</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {enrollments.filter((e) => e.status === 'aguardando_turma').length} matricula(s) aguardando formacao de turma
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar matricula..." className="input-base w-full pl-9" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base sm:w-48">
            <option value="all">Todas as situacoes</option>
            {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando matriculas..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title="Nenhuma matricula encontrada"
            description="Crie a primeira matricula"
            action={<button onClick={() => { setEditingEnrollment(null); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nova Matricula</button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(e) => e.id}
            actions={(e) => (
              <div className="flex items-center justify-end gap-2">
                <select
                  value={e.status}
                  onChange={(ev) => handleStatusChange(e, ev.target.value)}
                  className="input-base text-xs py-1"
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button
                  onClick={() => { setEditingEnrollment(e); setModalOpen(true); }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
              </div>
            )}
          />
        )}
      </Card>

      <EnrollmentFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEnrollment(null); }}
        enrollment={editingEnrollment}
        students={students}
        courses={courses}
        units={units}
        onSave={handleSave}
      />
    </div>
  );
}

function eStudentName(e: EnrollmentWithRelations): string {
  return e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Aluno';
}

function EnrollmentFormModal({
  open, onClose, enrollment, students, courses, units, onSave,
}: {
  open: boolean;
  onClose: () => void;
  enrollment: EnrollmentWithRelations | null;
  students: Student[];
  courses: Course[];
  units: Unit[];
  onSave: (data: Partial<Enrollment>) => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Enrollment>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        enrollment
          ? {
              student_id: enrollment.student_id,
              course_id: enrollment.course_id,
              unit_id: enrollment.unit_id,
              status: enrollment.status,
              enrollment_date: enrollment.enrollment_date,
              start_date: enrollment.start_date,
              end_date: enrollment.end_date,
              notes: enrollment.notes,
            }
          : {
              student_id: '', course_id: '', unit_id: '',
              status: 'pendente', enrollment_date: new Date().toISOString().split('T')[0],
              start_date: '', end_date: '', notes: '',
            }
      );
    }
  }, [open, enrollment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.student_id || !formData.course_id) { toast('Aluno e curso sao obrigatorios', 'warning'); return; }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        unit_id: formData.unit_id || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={enrollment ? 'Editar Matricula' : 'Nova Matricula'}
      description={enrollment ? enrollment.code : 'Selecione o aluno e o curso'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Aluno" required>
          <select value={formData.student_id || ''} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} className="input-base w-full" disabled={!!enrollment}>
            <option value="">Selecione um aluno</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.code})</option>)}
          </select>
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Curso" required>
            <select value={formData.course_id || ''} onChange={(e) => setFormData({ ...formData, course_id: e.target.value })} className="input-base w-full">
              <option value="">Selecione um curso</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
          <FormField label="Unidade">
            <select value={formData.unit_id || ''} onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })} className="input-base w-full">
              <option value="">Selecione uma unidade</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </FormField>
          <FormField label="Situacao">
            <select value={formData.status || 'pendente'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base w-full">
              {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </FormField>
          <FormField label="Data da Matricula">
            <input type="date" value={formData.enrollment_date || ''} onChange={(e) => setFormData({ ...formData, enrollment_date: e.target.value })} className="input-base w-full" />
          </FormField>
          <FormField label="Data de Inicio">
            <input type="date" value={formData.start_date || ''} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="input-base w-full" />
          </FormField>
          <FormField label="Data de Conclusao">
            <input type="date" value={formData.end_date || ''} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="input-base w-full" />
          </FormField>
        </div>
        <FormField label="Observacoes">
          <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="input-base w-full min-h-[60px] resize-y" placeholder="Notas adicionais..." />
        </FormField>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
          <button type="button" onClick={onClose} className="btn-ghost"><X size={16} /> Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}
