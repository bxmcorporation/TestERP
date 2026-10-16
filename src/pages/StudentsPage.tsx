import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import {
  Users, UserPlus, Search, Eye, Pencil, Trash2, Phone, Mail,
  Calendar, ClipboardList, School, TrendingUp, Wallet,
  FileText, ArrowLeft, Save, X,
} from 'lucide-react';
import type { Student, Course, Guardian, StudentGuardian, Enrollment, Class, FinancialItem, Attendance, Lesson } from '@/lib/types';

type StudentWithRelations = Student & {
  course?: Course;
  unit?: { name: string };
  student_guardians?: (StudentGuardian & { guardian: Guardian })[];
};

export function StudentsPage({ initialSearch }: { initialSearch?: string }) {
  const [students, setStudents] = useState<StudentWithRelations[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch || '');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentWithRelations | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*, course:courses(*), unit:units(name), student_guardians(*, guardian:guardians(*))')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents((data || []) as StudentWithRelations[]);

      const { data: coursesData } = await supabase.from('courses').select('*').eq('status', 'ativo').order('name');
      setCourses((coursesData || []) as Course[]);

      const { data: unitsData } = await supabase.from('units').select('id, name').order('name');
      setUnits(unitsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, [initialSearch]);

  const filtered = students.filter((s) => {
    const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchesSearch = !search || fullName.includes(search.toLowerCase()) || s.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async (formData: Partial<Student>) => {
    try {
      if (editingStudent) {
        const { id } = editingStudent;
        const { error } = await supabase
          .from('students')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity('student', 'Aluno atualizado', `${formData.first_name} ${formData.last_name}`, 'student', id);
      } else {
        const newCode = await generateCode('ALU', 'students');
        const { data, error } = await supabase
          .from('students')
          .insert({ ...formData, code: newCode })
          .select()
          .single();
        if (error) throw error;
        await logActivity('student', 'Aluno cadastrado', `${formData.first_name} ${formData.last_name}`, 'student', data.id);
      }
      setModalOpen(false);
      setEditingStudent(null);
      loadStudents();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao salvar aluno', 'error');
    }
  };

  const handleDelete = async (student: StudentWithRelations) => {
    if (!confirm(`Excluir o aluno ${student.first_name} ${student.last_name}?`)) return;
    try {
      const { error } = await supabase.from('students').delete().eq('id', student.id);
      if (error) throw error;
      await logActivity('student', 'Aluno excluido', `${student.first_name} ${student.last_name}`, 'student', student.id);
      loadStudents();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao excluir aluno', 'error');
    }
  };

  if (selectedStudentId) {
    return (
      <StudentProfile
        studentId={selectedStudentId}
        onBack={() => {
          setSelectedStudentId(null);
          loadStudents();
        }}
        onEdit={() => {
          const s = students.find((st) => st.id === selectedStudentId);
          if (s) { setEditingStudent(s); setModalOpen(true); }
        }}
      />
    );
  }

  const columns: Column<StudentWithRelations>[] = [
    {
      key: 'code',
      label: 'Codigo',
      render: (s) => <span className="text-xs text-gray-400 font-mono">{s.code}</span>,
    },
    {
      key: 'name',
      label: 'Nome',
      render: (s) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center text-xs font-medium text-rayon-orange shrink-0">
            {s.first_name.charAt(0)}{s.last_name.charAt(0)}
          </div>
          <span className="text-gray-800 font-medium">{s.first_name} {s.last_name}</span>
        </div>
      ),
    },
    {
      key: 'course',
      label: 'Curso',
      render: (s) => <span className="text-gray-500">{s.course?.name || '—'}</span>,
    },
    {
      key: 'guardian',
      label: 'Responsavel',
      render: (s) => {
        const primary = s.student_guardians?.find((sg) => sg.is_primary)?.guardian
          || s.student_guardians?.[0]?.guardian;
        return primary ? (
          <span className="text-gray-500">{primary.first_name} {primary.last_name}</span>
        ) : <span className="text-gray-300">—</span>;
      },
    },
    {
      key: 'created_at',
      label: 'Cadastro',
      render: (s) => <span className="text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString('pt-BR')}</span>,
    },
    {
      key: 'status',
      label: 'Situacao',
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Alunos"
        description="Gerencie os alunos da RAYON Academy"
        actions={[
          {
            label: 'Novo Aluno',
            icon: <UserPlus size={16} />,
            onClick: () => { setEditingStudent(null); setModalOpen(true); },
          },
        ]}
      />

      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou codigo..."
              className="input-base w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base sm:w-48"
          >
            <option value="all">Todas as situacoes</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="suspenso">Suspenso</option>
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando alunos..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadStudents} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={32} />}
            title="Nenhum aluno encontrado"
            description="Cadastre o primeiro aluno para comecar"
            action={
              <button onClick={() => { setEditingStudent(null); setModalOpen(true); }} className="btn-primary">
                <UserPlus size={16} /> Novo Aluno
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(s) => s.id}
            onRowClick={(s) => setSelectedStudentId(s.id)}
            actions={(s) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedStudentId(s.id); }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Visualizar"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingStudent(s); setModalOpen(true); }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-500/10 transition-all"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        )}
      </Card>

      <StudentFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingStudent(null); }}
        student={editingStudent}
        courses={courses}
        units={units}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// STUDENT FORM MODAL
// ============================================================
function StudentFormModal({
  open, onClose, student, courses, units, onSave,
}: {
  open: boolean;
  onClose: () => void;
  student: StudentWithRelations | null;
  courses: Course[];
  units: { id: string; name: string }[];
  onSave: (data: Partial<Student>) => void;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Student>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        student
          ? {
              first_name: student.first_name,
              last_name: student.last_name,
              birth_date: student.birth_date,
              email: student.email,
              phone: student.phone,
              status: student.status,
              academic_status: student.academic_status,
              course_id: student.course_id,
              unit_id: student.unit_id,
              notes: student.notes,
            }
          : {
              first_name: '',
              last_name: '',
              birth_date: '',
              email: '',
              phone: '',
              status: 'ativo',
              academic_status: 'nao_matriculado',
              course_id: '',
              unit_id: '',
              notes: '',
            }
      );
    }
  }, [open, student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      toast('Nome e sobrenome sao obrigatorios', 'warning');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        course_id: formData.course_id || null,
        unit_id: formData.unit_id || null,
        birth_date: formData.birth_date || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={student ? 'Editar Aluno' : 'Novo Aluno'}
      description={student ? `${student.code} — ${student.first_name} ${student.last_name}` : 'Preencha os dados pessoais do aluno'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Dados Pessoais</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome" required>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="input-base w-full"
                placeholder="Nome do aluno"
              />
            </FormField>
            <FormField label="Sobrenome" required>
              <input
                type="text"
                value={formData.last_name || ''}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="input-base w-full"
                placeholder="Sobrenome"
              />
            </FormField>
            <FormField label="Data de Nascimento">
              <input
                type="date"
                value={formData.birth_date || ''}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                className="input-base w-full"
              />
            </FormField>
            <FormField label="Situacao Cadastral">
              <select
                value={formData.status || 'ativo'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input-base w-full"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="suspenso">Suspenso</option>
              </select>
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-base w-full"
                placeholder="email@exemplo.com"
              />
            </FormField>
            <FormField label="Telefone">
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="input-base w-full"
                placeholder="(11) 99999-9999"
              />
            </FormField>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Informacoes Academicas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Curso">
              <select
                value={formData.course_id || ''}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">Selecione um curso</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Unidade">
              <select
                value={formData.unit_id || ''}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">Selecione uma unidade</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </FormField>
            <FormField label="Situacao Academica">
              <select
                value={formData.academic_status || 'nao_matriculado'}
                onChange={(e) => setFormData({ ...formData, academic_status: e.target.value })}
                className="input-base w-full"
              >
                <option value="nao_matriculado">Nao matriculado</option>
                <option value="matriculado">Matriculado</option>
                <option value="em_curso">Em curso</option>
                <option value="concluido">Concluido</option>
              </select>
            </FormField>
          </div>
        </div>

        <FormField label="Observacoes">
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-base w-full min-h-[80px] resize-y"
            placeholder="Notas adicionais sobre o aluno..."
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-edge">
          <button type="button" onClick={onClose} className="btn-ghost">
            <X size={16} /> Cancelar
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// STUDENT PROFILE
// ============================================================
function StudentProfile({ studentId, onBack, onEdit }: { studentId: string; onBack: () => void; onEdit: () => void }) {
  const [student, setStudent] = useState<StudentWithRelations | null>(null);
  const [enrollments, setEnrollments] = useState<(Enrollment & { course?: Course })[]>([]);
  const [classes, setClasses] = useState<(Class & { course?: Course })[]>([]);
  const [financial, setFinancial] = useState<FinancialItem[]>([]);
  const [attendance, setAttendance] = useState<(Attendance & { lesson?: Lesson })[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: sData } = await supabase
          .from('students')
          .select('*, course:courses(*), unit:units(name), student_guardians(*, guardian:guardians(*))')
          .eq('id', studentId)
          .maybeSingle();
        if (sData) setStudent(sData as StudentWithRelations);

        const { data: enrData } = await supabase
          .from('enrollments')
          .select('*, course:courses(*)')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        setEnrollments((enrData || []) as (Enrollment & { course?: Course })[]);

        const { data: csData } = await supabase
          .from('class_students')
          .select('class:classes(*, course:courses(*))')
          .eq('student_id', studentId);
        setClasses((csData || []).map((cs: Record<string, unknown>) => cs.class as Class & { course?: Course }));

        const { data: finData } = await supabase
          .from('financial_items')
          .select('*')
          .eq('student_id', studentId)
          .order('due_date', { ascending: false });
        setFinancial((finData || []) as FinancialItem[]);

        const { data: attData } = await supabase
          .from('attendance')
          .select('*, lesson:lessons(*)')
          .eq('student_id', studentId)
          .order('recorded_at', { ascending: false })
          .limit(20);
        setAttendance((attData || []) as (Attendance & { lesson?: Lesson })[]);
      } catch {
        // handled by loading state
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [studentId]);

  if (loading) return <LoadingState message="Carregando perfil..." />;
  if (!student) return <ErrorState message="Aluno nao encontrado" onRetry={onBack} />;

  const fullName = `${student.first_name} ${student.last_name}`;
  const age = student.birth_date
    ? Math.floor((Date.now() - new Date(student.birth_date).getTime()) / 365.25 / 24 / 60 / 60 / 1000)
    : null;

  const presentCount = attendance.filter((a) => a.status === 'presente').length;
  const attendanceRate = attendance.length > 0 ? Math.round(presentCount / attendance.length * 100) : 0;

  const tabs = [
    {
      key: 'overview',
      label: 'Visao Geral',
      icon: <Eye size={15} />,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dados Pessoais</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-400">Codigo</dt><dd className="text-gray-700 font-mono">{student.code}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Nome</dt><dd className="text-gray-700">{fullName}</dd></div>
              {age !== null && <div className="flex justify-between"><dt className="text-gray-400">Idade</dt><dd className="text-gray-700">{age} anos</dd></div>}
              {student.birth_date && <div className="flex justify-between"><dt className="text-gray-400">Nascimento</dt><dd className="text-gray-700">{new Date(student.birth_date).toLocaleDateString('pt-BR')}</dd></div>}
              {student.email && <div className="flex justify-between"><dt className="text-gray-400">Email</dt><dd className="text-gray-700">{student.email}</dd></div>}
              {student.phone && <div className="flex justify-between"><dt className="text-gray-400">Telefone</dt><dd className="text-gray-700">{student.phone}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-400">Cadastro</dt><dd className="text-gray-700">{new Date(student.created_at).toLocaleDateString('pt-BR')}</dd></div>
            </dl>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Situacao Atual</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between items-center"><dt className="text-gray-400">Cadastral</dt><dd><StatusBadge status={student.status} /></dd></div>
              <div className="flex justify-between items-center"><dt className="text-gray-400">Academica</dt><dd><StatusBadge status={student.academic_status} /></dd></div>
              {student.course && <div className="flex justify-between"><dt className="text-gray-400">Curso</dt><dd className="text-gray-700">{student.course.name}</dd></div>}
              {student.unit && <div className="flex justify-between"><dt className="text-gray-400">Unidade</dt><dd className="text-gray-700">{student.unit.name}</dd></div>}
              <div className="flex justify-between"><dt className="text-gray-400">Matriculas</dt><dd className="text-gray-700">{enrollments.length}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-400">Turmas</dt><dd className="text-gray-700">{classes.length}</dd></div>
            </dl>
          </Card>
          {student.notes && (
            <Card className="md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Observacoes</h3>
              <p className="text-sm text-gray-500">{student.notes}</p>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'guardians',
      label: 'Responsaveis',
      icon: <Users size={15} />,
      content: (
        <div>
          {(!student.student_guardians || student.student_guardians.length === 0) ? (
            <EmptyState icon={<Users size={28} />} title="Nenhum responsavel vinculado" description="Vincule responsaveis na gestao de responsaveis" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {student.student_guardians.map((sg) => (
                <Card key={sg.id}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 border border-edge flex items-center justify-center text-xs font-medium text-gray-500">
                        {sg.guardian.first_name.charAt(0)}{sg.guardian.last_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{sg.guardian.first_name} {sg.guardian.last_name}</p>
                        <p className="text-xs text-gray-400">{sg.relationship_type}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {sg.is_primary && <StatusBadge status="ativo" />}
                    </div>
                  </div>
                  {sg.guardian.phone && <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-2"><Phone size={12} /> {sg.guardian.phone}</p>}
                  {sg.guardian.email && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Mail size={12} /> {sg.guardian.email}</p>}
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'enrollments',
      label: 'Matriculas',
      icon: <ClipboardList size={15} />,
      content: (
        <div>
          {enrollments.length === 0 ? (
            <EmptyState icon={<ClipboardList size={28} />} title="Nenhuma matricula" description="Crie uma matricula para este aluno" />
          ) : (
            <div className="space-y-2">
              {enrollments.map((enr) => (
                <Card key={enr.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{enr.course?.name || 'Curso nao encontrado'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {enr.code} · Matriculado em {new Date(enr.enrollment_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <StatusBadge status={enr.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'classes',
      label: 'Turmas',
      icon: <School size={15} />,
      content: (
        <div>
          {classes.length === 0 ? (
            <EmptyState icon={<School size={28} />} title="Nenhuma turma" description="O aluno nao esta associado a nenhuma turma" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {classes.map((cls) => (
                <Card key={cls.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-800">{cls.name}</p>
                    <StatusBadge status={cls.status} />
                  </div>
                  <p className="text-xs text-gray-400">{cls.course?.name}</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'attendance',
      label: 'Aulas e Frequencia',
      icon: <Calendar size={15} />,
      content: (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="text-center">
              <p className="text-2xl font-display font-bold text-gray-900">{attendance.length}</p>
              <p className="text-xs text-gray-400 mt-1">Total Registros</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-display font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-gray-400 mt-1">Presencas</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-display font-bold text-rayon-orange">{attendanceRate}%</p>
              <p className="text-xs text-gray-400 mt-1">Taxa de Presenca</p>
            </Card>
          </div>
          {attendance.length === 0 ? (
            <EmptyState icon={<Calendar size={28} />} title="Sem registros de frequencia" />
          ) : (
            <Card>
              <div className="space-y-2">
                {attendance.map((att) => (
                  <div key={att.id} className="flex items-center justify-between py-2 border-b border-edge/subtle last:border-0">
                    <div>
                      <p className="text-sm text-gray-700">{att.lesson?.title || 'Aula'}</p>
                      <p className="text-xs text-gray-400">
                        {att.lesson ? new Date(att.lesson.lesson_date).toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                    <StatusBadge status={att.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'progress',
      label: 'Progresso',
      icon: <TrendingUp size={15} />,
      content: (
        <EmptyState
          icon={<TrendingUp size={28} />}
          title="Modulo de acompanhamento pedagogico em desenvolvimento"
          description="Esta area ira acompanhar o desenvolvimento de habilidades do aluno"
        />
      ),
    },
    {
      key: 'financial',
      label: 'Financeiro',
      icon: <Wallet size={15} />,
      content: (
        <div>
          {financial.length === 0 ? (
            <EmptyState icon={<Wallet size={28} />} title="Sem lancamentos financeiros" description="Nenhuma cobranca demonstrativa vinculada" />
          ) : (
            <div className="space-y-2">
              {financial.map((item) => (
                <Card key={item.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{item.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.code} · Venc: {item.due_date ? new Date(item.due_date).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">
                        R$ {item.amount.toFixed(2).replace('.', ',')}
                      </span>
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'history',
      label: 'Historico',
      icon: <FileText size={15} />,
      content: (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Historico de Atividades</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3 py-2 border-b border-edge/subtle">
              <div className="p-1.5 rounded-md bg-gray-100 text-gray-400"><UserPlus size={14} /></div>
              <div className="flex-1">
                <p className="text-gray-700">Aluno cadastrado</p>
                <p className="text-xs text-gray-400">{new Date(student.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            {student.updated_at !== student.created_at && (
              <div className="flex items-center gap-3 py-2 border-b border-edge/subtle">
                <div className="p-1.5 rounded-md bg-gray-100 text-gray-400"><Pencil size={14} /></div>
                <div className="flex-1">
                  <p className="text-gray-700">Dados atualizados</p>
                  <p className="text-xs text-gray-400">{new Date(student.updated_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-900 mb-4 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar para alunos
      </button>

      {/* Profile Header */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center text-xl font-display font-bold text-rayon-orange shrink-0">
            {student.first_name.charAt(0)}{student.last_name.charAt(0)}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-gray-900">{fullName}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{student.code} · {student.course?.name || 'Sem curso'}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={student.status} />
              <StatusBadge status={student.academic_status} />
            </div>
          </div>
          <button
            onClick={onEdit}
            className="btn-ghost text-xs"
          >
            <Pencil size={14} /> Editar
          </button>
        </div>
      </Card>

      <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
    </div>
  );
}
