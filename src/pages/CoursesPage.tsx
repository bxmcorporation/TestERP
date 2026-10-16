import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import {
  GraduationCap, Plus, Pencil, Trash2, School, Save, X, Users, Clock,
} from 'lucide-react';
import type { Course, Class, Unit } from '@/lib/types';

type CourseWithClassCount = Course & {
  unit?: Unit;
  classCount?: number;
};

const COURSE_AREAS = [
  'Comunicacao e Oratoria',
  'Inteligencia Emocional',
  'Produtividade',
  'Inteligencia Artificial e Tecnologia',
  'Educacao Financeira',
  'Marca Pessoal e Desenvolvimento Profissional',
];

export function CoursesPage() {
  const [courses, setCourses] = useState<CourseWithClassCount[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithClassCount | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('*, unit:units(*)')
        .order('name');
      if (error) throw error;

      const withCounts = await Promise.all(
        ((data || []) as CourseWithClassCount[]).map(async (c) => {
          const { count } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('course_id', c.id);
          return { ...c, classCount: count || 0 };
        })
      );
      setCourses(withCounts);

      const { data: unitsData } = await supabase.from('units').select('*').order('name');
      setUnits((unitsData || []) as Unit[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (formData: Partial<Course>) => {
    try {
      if (editingCourse) {
        const { id, ...updateData } = editingCourse;
        const { error } = await supabase.from('courses').update({ ...formData, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        await logActivity('course', 'Curso atualizado', formData.name, 'course', id);
      } else {
        const { data, error } = await supabase.from('courses').insert(formData).select().single();
        if (error) throw error;
        await logActivity('course', 'Curso cadastrado', formData.name, 'course', data.id);
      }
      setModalOpen(false);
      setEditingCourse(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleDelete = async (c: CourseWithClassCount) => {
    if (c.classCount && c.classCount > 0) { alert('Nao e possivel excluir um curso com turmas vinculadas'); return; }
    if (!confirm(`Excluir o curso ${c.name}?`)) return;
    try {
      const { error } = await supabase.from('courses').delete().eq('id', c.id);
      if (error) throw error;
      await logActivity('course', 'Curso excluido', c.name, 'course', c.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  };

  const columns: Column<CourseWithClassCount>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (c) => (
        <div>
          <span className="text-gray-800 font-medium">{c.name}</span>
          {c.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{c.description}</p>}
        </div>
      ),
    },
    {
      key: 'duration',
      label: 'Duracao',
      render: (c) => <span className="text-gray-500">{c.duration_hours ? `${c.duration_hours}h` : '—'}</span>,
    },
    {
      key: 'modality',
      label: 'Modalidade',
      render: (c) => <span className="text-gray-500 capitalize">{c.modality}</span>,
    },
    {
      key: 'classes',
      label: 'Turmas',
      render: (c) => <span className="text-gray-500">{c.classCount || 0}</span>,
    },
    {
      key: 'unit',
      label: 'Unidade',
      render: (c) => <span className="text-gray-400 text-xs">{c.unit?.name || '—'}</span>,
    },
    { key: 'status', label: 'Situacao', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Cursos"
        description="Programas educacionais da RAYON Academy"
        actions={[{ label: 'Novo Curso', icon: <Plus size={16} />, onClick: () => { setEditingCourse(null); setModalOpen(true); } }]}
      />
      <Card>
        {loading ? (
          <LoadingState message="Carregando cursos..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : courses.length === 0 ? (
          <EmptyState icon={<GraduationCap size={32} />} title="Nenhum curso encontrado" description="Cadastre o primeiro curso" action={<button onClick={() => { setEditingCourse(null); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Novo Curso</button>} />
        ) : (
          <DataTable
            columns={columns}
            data={courses}
            rowKey={(c) => c.id}
            actions={(c) => (
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => { setEditingCourse(c); setModalOpen(true); }} className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all" title="Editar"><Pencil size={16} /></button>
                <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-500/10 transition-all" title="Excluir"><Trash2 size={16} /></button>
              </div>
            )}
          />
        )}
      </Card>
      <CourseFormModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingCourse(null); }} course={editingCourse} units={units} onSave={handleSave} />
    </div>
  );
}

function CourseFormModal({
  open, onClose, course, units, onSave,
}: {
  open: boolean;
  onClose: () => void;
  course: CourseWithClassCount | null;
  units: Unit[];
  onSave: (data: Partial<Course>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Course>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        course
          ? { name: course.name, description: course.description, duration_hours: course.duration_hours, modality: course.modality, status: course.status, unit_id: course.unit_id }
          : { name: '', description: '', duration_hours: 40, modality: 'presencial', status: 'ativo', unit_id: '' }
      );
    }
  }, [open, course]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) { alert('Nome e obrigatorio'); return; }
    setSaving(true);
    try {
      await onSave({ ...formData, unit_id: formData.unit_id || null, duration_hours: formData.duration_hours ? Number(formData.duration_hours) : null });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={course ? 'Editar Curso' : 'Novo Curso'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome do Curso" required>
          <input type="text" list="course-areas" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-base w-full" placeholder="Ex: Comunicacao e Oratoria" />
          <datalist id="course-areas">
            {COURSE_AREAS.map((a) => <option key={a} value={a} />)}
          </datalist>
        </FormField>
        <FormField label="Descricao">
          <textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-base w-full min-h-[60px] resize-y" placeholder="Descricao do curso..." />
        </FormField>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Duracao (horas)">
            <input type="number" value={formData.duration_hours || ''} onChange={(e) => setFormData({ ...formData, duration_hours: Number(e.target.value) })} className="input-base w-full" min="1" />
          </FormField>
          <FormField label="Modalidade">
            <select value={formData.modality || 'presencial'} onChange={(e) => setFormData({ ...formData, modality: e.target.value })} className="input-base w-full">
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
              <option value="hibrido">Hibrido</option>
            </select>
          </FormField>
          <FormField label="Situacao">
            <select value={formData.status || 'ativo'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base w-full">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </FormField>
        </div>
        <FormField label="Unidade">
          <select value={formData.unit_id || ''} onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })} className="input-base w-full">
            <option value="">Selecione uma unidade</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </FormField>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
          <button type="button" onClick={onClose} className="btn-ghost"><X size={16} /> Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// CLASSES PAGE
// ============================================================
const CLASS_STATUS_OPTIONS = [
  { value: 'planejamento', label: 'Planejamento' },
  { value: 'em_formacao', label: 'Em Formacao' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluida' },
  { value: 'cancelada', label: 'Cancelada' },
];

type ClassWithRelations = Class & {
  course?: Course;
  unit?: Unit;
  room?: { name: string };
  teachers?: { teacher_id: string }[];
  occupied?: number;
};

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassWithRelations[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string; unit_id: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassWithRelations | null>(null);
  const [formationModalOpen, setFormationModalOpen] = useState(false);
  const [formationClass, setFormationClass] = useState<ClassWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*, course:courses(*), unit:units(*), room:rooms(name), class_teachers(teacher_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        ((data || []) as ClassWithRelations[]).map(async (c) => {
          const { count } = await supabase
            .from('class_students')
            .select('*', { count: 'exact', head: true })
            .eq('class_id', c.id);
          return { ...c, occupied: count || 0 };
        })
      );
      setClasses(enriched);

      const [cRes, uRes, rRes, tRes] = await Promise.all([
        supabase.from('courses').select('*').eq('status', 'ativo').order('name'),
        supabase.from('units').select('*').order('name'),
        supabase.from('rooms').select('id, name, unit_id').eq('status', 'ativo').order('name'),
        supabase.from('teachers').select('id, first_name, last_name').eq('status', 'ativo').order('first_name'),
      ]);
      setCourses((cRes.data || []) as Course[]);
      setUnits((uRes.data || []) as Unit[]);
      setRooms((rRes.data || []) as { id: string; name: string; unit_id: string }[]);
      setTeachers((tRes.data || []) as { id: string; first_name: string; last_name: string }[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar turmas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = classes.filter((c) => statusFilter === 'all' || c.status === statusFilter);

  const handleSave = async (formData: Partial<Class> & { teacher_ids?: string[] }) => {
    try {
      const { teacher_ids, ...classData } = formData;
      if (editingClass) {
        const { id, ...updateData } = editingClass;
        const { error } = await supabase.from('classes').update({ ...classData, updated_at: new Date().toISOString() }).eq('id', id);
        if (error) throw error;
        if (teacher_ids) {
          await supabase.from('class_teachers').delete().eq('class_id', id);
          if (teacher_ids.length > 0) {
            await supabase.from('class_teachers').insert(teacher_ids.map((tid) => ({ class_id: id, teacher_id: tid })));
          }
        }
        await logActivity('class', 'Turma atualizada', formData.name, 'class', id);
      } else {
        const { data, error } = await supabase.from('classes').insert(classData).select().single();
        if (error) throw error;
        if (teacher_ids && teacher_ids.length > 0) {
          await supabase.from('class_teachers').insert(teacher_ids.map((tid) => ({ class_id: data.id, teacher_id: tid })));
        }
        await logActivity('class', 'Turma criada', formData.name, 'class', data.id);
      }
      setModalOpen(false);
      setEditingClass(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleStatusChange = async (cls: ClassWithRelations, newStatus: string) => {
    try {
      const { error } = await supabase.from('classes').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', cls.id);
      if (error) throw error;
      await logActivity('class', 'Status da turma alterado', `${cls.name}: ${newStatus}`, 'class', cls.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  const columns: Column<ClassWithRelations>[] = [
    {
      key: 'name',
      label: 'Turma',
      render: (c) => (
        <div>
          <span className="text-gray-800 font-medium">{c.name}</span>
          <p className="text-xs text-gray-400 font-mono">{c.code}</p>
        </div>
      ),
    },
    { key: 'course', label: 'Curso', render: (c) => <span className="text-gray-500">{c.course?.name || '—'}</span> },
    {
      key: 'occupancy',
      label: 'Ocupacao',
      render: (c) => {
        const pct = c.max_capacity ? (c.occupied || 0) / c.max_capacity * 100 : 0;
        return (
          <div className="min-w-[100px]">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">{c.occupied || 0}/{c.max_capacity}</span>
              {pct >= 100 && <span className="text-red-600">Lotada</span>}
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : pct >= 60 ? 'bg-green-500' : 'bg-rayon-orange'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        );
      },
    },
    { key: 'room', label: 'Sala', render: (c) => <span className="text-gray-400 text-xs">{c.room?.name || '—'}</span> },
    { key: 'status', label: 'Situacao', render: (c) => <StatusBadge status={c.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Gerencie turmas e acompanhe a formacao"
        actions={[{ label: 'Nova Turma', icon: <Plus size={16} />, onClick: () => { setEditingClass(null); setModalOpen(true); } }]}
      />

      {/* Formation overview */}
      {classes.filter((c) => c.status === 'em_formacao').length > 0 && (
        <Card className="mb-4 border-rayon-orange/15">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-rayon-orange/10 border border-rayon-orange/20 text-rayon-orange">
              <Users size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900">Turmas em Formacao</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {classes.filter((c) => c.status === 'em_formacao').length} turma(s) aguardando confirmacao
              </p>
            </div>
            <button onClick={() => { const fc = classes.find((c) => c.status === 'em_formacao'); if (fc) { setFormationClass(fc); setFormationModalOpen(true); } }} className="btn-ghost text-xs">
              Ver formacao <Clock size={14} />
            </button>
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base sm:w-56">
          <option value="all">Todas as situacoes</option>
          {CLASS_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando turmas..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<School size={32} />} title="Nenhuma turma encontrada" description="Crie a primeira turma" action={<button onClick={() => { setEditingClass(null); setModalOpen(true); }} className="btn-primary"><Plus size={16} /> Nova Turma</button>} />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(c) => c.id}
            actions={(c) => (
              <div className="flex items-center justify-end gap-2">
                {c.status === 'em_formacao' && (
                  <button onClick={() => { setFormationClass(c); setFormationModalOpen(true); }} className="btn-ghost text-xs">
                    Formar turma
                  </button>
                )}
                <select value={c.status} onChange={(ev) => handleStatusChange(c, ev.target.value)} className="input-base text-xs py-1" onClick={(ev) => ev.stopPropagation()}>
                  {CLASS_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button onClick={() => { setEditingClass(c); setModalOpen(true); }} className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all" title="Editar"><Pencil size={16} /></button>
              </div>
            )}
          />
        )}
      </Card>

      <ClassFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingClass(null); }}
        cls={editingClass}
        courses={courses}
        units={units}
        rooms={rooms}
        teachers={teachers}
        onSave={handleSave}
      />

      <FormationModal
        open={formationModalOpen}
        onClose={() => { setFormationModalOpen(false); setFormationClass(null); }}
        cls={formationClass}
        onConfirm={async (cls) => { await handleStatusChange(cls, 'confirmada'); setFormationModalOpen(false); setFormationClass(null); }}
        onUpdated={load}
      />
    </div>
  );
}

function ClassFormModal({
  open, onClose, cls, courses, units, rooms, teachers, onSave,
}: {
  open: boolean;
  onClose: () => void;
  cls: ClassWithRelations | null;
  courses: Course[];
  units: Unit[];
  rooms: { id: string; name: string; unit_id: string }[];
  teachers: { id: string; first_name: string; last_name: string }[];
  onSave: (data: Partial<Class> & { teacher_ids?: string[] }) => void;
}) {
  const [formData, setFormData] = useState<Partial<Class> & { teacher_ids?: string[] }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        cls
          ? {
              name: cls.name, course_id: cls.course_id, unit_id: cls.unit_id, room_id: cls.room_id,
              status: cls.status, min_capacity: cls.min_capacity, max_capacity: cls.max_capacity,
              start_date: cls.start_date, end_date: cls.end_date,
              teacher_ids: cls.teachers?.map((t) => t.teacher_id) || [],
            }
          : {
              name: '', course_id: '', unit_id: '', room_id: '',
              status: 'planejamento', min_capacity: 10, max_capacity: 15,
              start_date: '', end_date: '', teacher_ids: [],
            }
      );
    }
  }, [open, cls]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.course_id) { alert('Nome e curso sao obrigatorios'); return; }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        room_id: formData.room_id || null,
        unit_id: formData.unit_id || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        min_capacity: Number(formData.min_capacity) || 10,
        max_capacity: Number(formData.max_capacity) || 15,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleTeacher = (id: string) => {
    const current = formData.teacher_ids || [];
    setFormData({
      ...formData,
      teacher_ids: current.includes(id) ? current.filter((t) => t !== id) : [...current, id],
    });
  };

  const filteredRooms = rooms.filter((r) => !formData.unit_id || r.unit_id === formData.unit_id);

  return (
    <Modal open={open} onClose={onClose} title={cls ? 'Editar Turma' : 'Nova Turma'} description={cls ? cls.code : 'Defina curso, capacidades e professores'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome da Turma" required>
            <input type="text" value={formData.name || ''} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-base w-full" placeholder="Ex: Turma A - Manha 2026" />
          </FormField>
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
          <FormField label="Sala">
            <select value={formData.room_id || ''} onChange={(e) => setFormData({ ...formData, room_id: e.target.value })} className="input-base w-full">
              <option value="">Selecione uma sala</option>
              {filteredRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </FormField>
          <FormField label="Capacidade Minima" hint="Minimo para confirmar a turma">
            <input type="number" value={formData.min_capacity || ''} onChange={(e) => setFormData({ ...formData, min_capacity: Number(e.target.value) })} className="input-base w-full" min="1" />
          </FormField>
          <FormField label="Capacidade Maxima">
            <input type="number" value={formData.max_capacity || ''} onChange={(e) => setFormData({ ...formData, max_capacity: Number(e.target.value) })} className="input-base w-full" min="1" />
          </FormField>
          <FormField label="Data de Inicio">
            <input type="date" value={formData.start_date || ''} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="input-base w-full" />
          </FormField>
          <FormField label="Data de Conclusao">
            <input type="date" value={formData.end_date || ''} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="input-base w-full" />
          </FormField>
        </div>

        <FormField label="Situacao">
          <select value={formData.status || 'planejamento'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base w-full">
            {CLASS_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </FormField>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Professores</label>
          <div className="flex flex-wrap gap-2">
            {teachers.map((t) => {
              const selected = formData.teacher_ids?.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeacher(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                    selected ? 'bg-rayon-orange/10 text-rayon-orange border border-rayon-orange/30' : 'bg-gray-100 text-gray-400 border border-edge hover:bg-gray-100'
                  }`}
                >
                  {t.first_name} {t.last_name}
                </button>
              );
            })}
            {teachers.length === 0 && <p className="text-xs text-gray-300">Nenhum professor cadastrado</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
          <button type="button" onClick={onClose} className="btn-ghost"><X size={16} /> Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary"><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ============================================================
// FORMATION MODAL — Shows students waiting + allows assignment
// ============================================================
function FormationModal({
  open, onClose, cls, onConfirm, onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  cls: ClassWithRelations | null;
  onConfirm: (cls: ClassWithRelations) => void;
  onUpdated: () => void;
}) {
  const [waitingStudents, setWaitingStudents] = useState<{ id: string; first_name: string; last_name: string; code: string; course_id: string }[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<{ id: string; first_name: string; last_name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && cls) {
      loadStudents();
    }
  }, [open, cls]);

  const loadStudents = async () => {
    if (!cls) return;
    setLoading(true);
    try {
      // Students enrolled in this class
      const { data: enrolled } = await supabase
        .from('class_students')
        .select('student:students(id, first_name, last_name, code)')
        .eq('class_id', cls.id);
      setEnrolledStudents((enrolled || []).map((e: Record<string, unknown>) => e.student as { id: string; first_name: string; last_name: string; code: string }));

      // Students waiting for a class in the same course
      const { data: waiting } = await supabase
        .from('enrollments')
        .select('student:students(id, first_name, last_name, code, course_id)')
        .eq('course_id', cls.course_id)
        .eq('status', 'aguardando_turma');
      
      const enrolledIds = new Set((enrolled || []).map((e: Record<string, unknown>) => (e.student as { id: string }).id));
      setWaitingStudents(
        ((waiting || []) as Record<string, unknown>[])
          .map((w) => w.student as { id: string; first_name: string; last_name: string; code: string; course_id: string })
          .filter((s) => !enrolledIds.has(s.id))
      );
    } finally {
      setLoading(false);
    }
  };

  const assignStudent = async (studentId: string) => {
    if (!cls) return;
    if ((enrolledStudents.length) >= cls.max_capacity) {
      alert('Capacidade maxima da turma atingida');
      return;
    }
    try {
      const { error } = await supabase
        .from('class_students')
        .insert({ class_id: cls.id, student_id: studentId, status: 'ativo' });
      if (error) throw error;

      // Update enrollment status
      await supabase
        .from('enrollments')
        .update({ status: 'ativa' })
        .eq('student_id', studentId)
        .eq('course_id', cls.course_id)
        .eq('status', 'aguardando_turma');

      // Update student academic status
      await supabase
        .from('students')
        .update({ academic_status: 'matriculado' })
        .eq('id', studentId);

      await logActivity('class', 'Aluno associado a turma', `${cls.name}`, 'class', cls.id);
      loadStudents();
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao associar aluno');
    }
  };

  const removeStudent = async (studentId: string) => {
    if (!cls) return;
    try {
      const { error } = await supabase
        .from('class_students')
        .delete()
        .eq('class_id', cls.id)
        .eq('student_id', studentId);
      if (error) throw error;
      await logActivity('class', 'Aluno removido da turma', `${cls.name}`, 'class', cls.id);
      loadStudents();
      onUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao remover aluno');
    }
  };

  if (!cls) return null;

  const canConfirm = enrolledStudents.length >= cls.min_capacity;
  const pct = cls.max_capacity ? enrolledStudents.length / cls.max_capacity * 100 : 0;

  return (
    <Modal open={open} onClose={onClose} title="Formacao de Turma" description={`${cls.name} — ${cls.course?.name || ''}`} size="lg">
      {loading ? (
        <LoadingState message="Carregando alunos..." />
      ) : (
        <div className="space-y-5">
          {/* Capacity bar */}
          <div className="p-4 rounded-lg bg-gray-50 border border-edge">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-700">Ocupacao</span>
              <span className="text-sm text-gray-500">{enrolledStudents.length} / {cls.max_capacity}</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-2">
              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-500' : 'bg-rayon-orange'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className={canConfirm ? 'text-green-600' : 'text-gray-400'}>
                {canConfirm ? 'Minimo atingido — pronto para confirmar' : `Faltam ${cls.min_capacity - enrolledStudents.length} aluno(s) para o minimo`}
              </span>
              <span className="text-gray-300">Min: {cls.min_capacity} · Max: {cls.max_capacity}</span>
            </div>
          </div>

          {/* Enrolled students */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Alunos Matriculados ({enrolledStudents.length})</h3>
            {enrolledStudents.length === 0 ? (
              <p className="text-sm text-gray-300 py-4 text-center bg-gray-50 rounded-lg">Nenhum aluno matriculado ainda</p>
            ) : (
              <div className="space-y-1.5">
                {enrolledStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-xs text-green-600 font-medium">
                        {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-800">{s.first_name} {s.last_name}</span>
                      <span className="text-xs text-gray-300 font-mono">{s.code}</span>
                    </div>
                    <button onClick={() => removeStudent(s.id)} className="text-xs text-red-600/70 hover:text-red-600">Remover</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Waiting students */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Alunos Aguardando Turma ({waitingStudents.length})</h3>
            {waitingStudents.length === 0 ? (
              <p className="text-sm text-gray-300 py-4 text-center bg-gray-50 rounded-lg">Nenhum aluno aguardando para este curso</p>
            ) : (
              <div className="space-y-1.5">
                {waitingStudents.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-xs text-yellow-600 font-medium">
                        {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-800">{s.first_name} {s.last_name}</span>
                      <span className="text-xs text-gray-300 font-mono">{s.code}</span>
                    </div>
                    <button
                      onClick={() => assignStudent(s.id)}
                      disabled={enrolledStudents.length >= cls.max_capacity}
                      className="text-xs text-rayon-orange hover:underline disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Associar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-edge">
            <p className="text-xs text-gray-400">
              {canConfirm
                ? 'A turma pode ser confirmada pela coordenacao'
                : 'A coordenacao deve confirmar a abertura manualmente'}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-ghost">Fechar</button>
              <button
                onClick={() => onConfirm(cls)}
                disabled={!canConfirm}
                className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar Turma
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
