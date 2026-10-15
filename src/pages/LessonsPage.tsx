import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import {
  BookOpen, Plus, Search, Pencil, Trash2, Save, X, Clock, Calendar, Target,
} from 'lucide-react';
import type { Lesson, Class, Teacher } from '@/lib/types';

const LESSON_STATUS_OPTIONS = [
  { value: 'agendada', label: 'Agendada' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'cancelada', label: 'Cancelada' },
];

type LessonWithRelations = Lesson & {
  class?: { name: string };
  teacher?: { first_name: string; last_name: string };
};

export function LessonsPage() {
  const [lessons, setLessons] = useState<LessonWithRelations[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState('upcoming');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*, class:classes(name), teacher:teachers(first_name, last_name)')
        .order('lesson_date', { ascending: false })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setLessons((data || []) as LessonWithRelations[]);

      const [cRes, tRes] = await Promise.all([
        supabase.from('classes').select('id, name').in('status', ['confirmada', 'em_andamento']).order('name'),
        supabase.from('teachers').select('id, first_name, last_name').eq('status', 'ativo').order('first_name'),
      ]);
      setClasses((cRes.data || []) as { id: string; name: string }[]);
      setTeachers((tRes.data || []) as { id: string; first_name: string; last_name: string }[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar aulas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = lessons.filter((l) => {
    const matchesSearch =
      !search ||
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.class?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = filtered.filter((l) => l.lesson_date >= today && l.status === 'agendada');
  const past = filtered.filter((l) => l.lesson_date < today || l.status !== 'agendada');

  const handleSave = async (formData: Partial<Lesson>) => {
    try {
      if (editingLesson) {
        const { id, created_at, updated_at, ...updateData } = editingLesson;
        const { error } = await supabase
          .from('lessons')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity('lesson', 'Aula atualizada', formData.title, 'lesson', id);
      } else {
        const { data, error } = await supabase
          .from('lessons')
          .insert(formData)
          .select()
          .single();
        if (error) throw error;
        await logActivity('lesson', 'Aula cadastrada', formData.title || 'Nova aula', 'lesson', data.id);
      }
      setModalOpen(false);
      setEditingLesson(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar aula');
    }
  };

  const handleDelete = async (lesson: LessonWithRelations) => {
    if (!confirm(`Excluir a aula "${lesson.title}"?`)) return;
    try {
      const { error } = await supabase.from('lessons').delete().eq('id', lesson.id);
      if (error) throw error;
      await logActivity('lesson', 'Aula excluída', lesson.title, 'lesson', lesson.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir aula');
    }
  };

  const teacherName = (l: LessonWithRelations) =>
    l.teacher ? `${l.teacher.first_name} ${l.teacher.last_name}` : '—';

  const columns: Column<LessonWithRelations>[] = [
    {
      key: 'title',
      label: 'Título',
      render: (l) => (
        <div>
          <span className="text-white/90 font-medium">{l.title}</span>
          {l.objective && <p className="text-xs text-white/40 mt-0.5 line-clamp-1">{l.objective}</p>}
        </div>
      ),
    },
    {
      key: 'lesson_date',
      label: 'Data',
      render: (l) => (
        <span className="text-white/60 text-xs flex items-center gap-1.5">
          <Calendar size={12} />
          {new Date(l.lesson_date).toLocaleDateString('pt-BR')}
        </span>
      ),
    },
    {
      key: 'time',
      label: 'Horário',
      render: (l) => (
        <span className="text-white/60 text-xs flex items-center gap-1.5">
          <Clock size={12} /> {l.start_time} — {l.end_time}
        </span>
      ),
    },
    {
      key: 'class',
      label: 'Turma',
      render: (l) => <span className="text-white/60">{l.class?.name || '—'}</span>,
    },
    {
      key: 'teacher',
      label: 'Professor',
      render: (l) => <span className="text-white/50 text-xs">{teacherName(l)}</span>,
    },
    {
      key: 'status',
      label: 'Situação',
      render: (l) => <StatusBadge status={l.status} />,
    },
  ];

  const renderTable = (data: LessonWithRelations[]) =>
    data.length === 0 ? (
      <EmptyState
        icon={<BookOpen size={28} />}
        title="Nenhuma aula"
        description="Não há aulas nesta visualização"
      />
    ) : (
      <DataTable
        columns={columns}
        data={data}
        rowKey={(l) => l.id}
        actions={(l) => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => {
                setEditingLesson(l);
                setModalOpen(true);
              }}
              className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(l)}
              className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Excluir"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      />
    );

  const tabs = [
    {
      key: 'upcoming',
      label: `Próximas (${upcoming.length})`,
      icon: <Calendar size={15} />,
      content: renderTable(upcoming),
    },
    {
      key: 'past',
      label: `Anteriores (${past.length})`,
      icon: <Clock size={15} />,
      content: renderTable(past),
    },
    {
      key: 'all',
      label: 'Todas',
      icon: <BookOpen size={15} />,
      content: renderTable(filtered),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Aulas"
        description="Planejamento e registro de aulas da RAYON Academy"
        actions={[
          {
            label: 'Nova Aula',
            icon: <Plus size={16} />,
            onClick: () => {
              setEditingLesson(null);
              setModalOpen(true);
            },
          },
        ]}
      />

      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou turma..."
              className="input-base w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base sm:w-48"
          >
            <option value="all">Todas as situações</option>
            {LESSON_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {loading ? (
        <Card>
          <LoadingState message="Carregando aulas..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : lessons.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen size={32} />}
            title="Nenhuma aula encontrada"
            description="Cadastre a primeira aula para começar"
            action={
              <button
                onClick={() => {
                  setEditingLesson(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Nova Aula
              </button>
            }
          />
        </Card>
      ) : (
        <Card>
          <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        </Card>
      )}

      <LessonFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLesson(null);
        }}
        lesson={editingLesson}
        classes={classes}
        teachers={teachers}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// LESSON FORM MODAL
// ============================================================
function LessonFormModal({
  open,
  onClose,
  lesson,
  classes,
  teachers,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  lesson: LessonWithRelations | null;
  classes: { id: string; name: string }[];
  teachers: { id: string; first_name: string; last_name: string }[];
  onSave: (data: Partial<Lesson>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Lesson>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        lesson
          ? {
              title: lesson.title,
              class_id: lesson.class_id,
              teacher_id: lesson.teacher_id,
              lesson_date: lesson.lesson_date,
              start_time: lesson.start_time,
              end_time: lesson.end_time,
              objective: lesson.objective,
              content: lesson.content,
              status: lesson.status,
              observations: lesson.observations,
            }
          : {
              title: '',
              class_id: '',
              teacher_id: '',
              lesson_date: new Date().toISOString().slice(0, 10),
              start_time: '08:00',
              end_time: '09:00',
              objective: '',
              content: '',
              status: 'agendada',
              observations: '',
            }
      );
    }
  }, [open, lesson]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.class_id || !formData.teacher_id) {
      alert('Título, turma e professor são obrigatórios');
      return;
    }
    if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
      alert('O horário de início deve ser anterior ao horário de fim');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        objective: formData.objective || null,
        content: formData.content || null,
        observations: formData.observations || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lesson ? 'Editar Aula' : 'Nova Aula'}
      description={lesson ? lesson.title : 'Planeje uma nova aula'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Título da Aula" required>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="input-base w-full"
            placeholder="Ex: Aula 1 — Introdução à Comunicação"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Turma" required>
            <select
              value={formData.class_id || ''}
              onChange={(e) => setFormData({ ...formData, class_id: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Selecione uma turma</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Professor" required>
            <select
              value={formData.teacher_id || ''}
              onChange={(e) => setFormData({ ...formData, teacher_id: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Selecione um professor</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.first_name} {t.last_name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Data" required>
            <input
              type="date"
              value={formData.lesson_date || ''}
              onChange={(e) => setFormData({ ...formData, lesson_date: e.target.value })}
              className="input-base w-full"
            />
          </FormField>
          <FormField label="Início" required>
            <input
              type="time"
              value={formData.start_time || ''}
              onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
              className="input-base w-full"
            />
          </FormField>
          <FormField label="Fim" required>
            <input
              type="time"
              value={formData.end_time || ''}
              onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
              className="input-base w-full"
            />
          </FormField>
        </div>

        <FormField label="Objetivo">
          <input
            type="text"
            value={formData.objective || ''}
            onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
            className="input-base w-full"
            placeholder="Ex: Desenvolver técnicas de apresentação em público"
          />
        </FormField>

        <FormField label="Conteúdo Programático">
          <textarea
            value={formData.content || ''}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="input-base w-full min-h-[100px] resize-y"
            placeholder="Descreva o conteúdo que será abordado na aula..."
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Situação">
            <select
              value={formData.status || 'agendada'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input-base w-full"
            >
              {LESSON_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Observações">
          <textarea
            value={formData.observations || ''}
            onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
            className="input-base w-full min-h-[60px] resize-y"
            placeholder="Notas adicionais sobre a aula..."
          />
        </FormField>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
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
