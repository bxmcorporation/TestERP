import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState, Badge } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import {
  CalendarClock, Plus, Pencil, Trash2, Save, X, AlertTriangle, Clock, Grid3x3,
} from 'lucide-react';
import type { Schedule, Class, Teacher, Room } from '@/lib/types';

const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

const weekdayLabel = (n: number) => WEEKDAYS.find((w) => w.value === n)?.label || '—';

type ScheduleWithRelations = Schedule & {
  class?: { name: string };
  teacher?: { first_name: string; last_name: string };
  room?: { name: string };
};

export function SchedulesPage() {
  const [schedules, setSchedules] = useState<ScheduleWithRelations[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [rooms, setRooms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState('grid');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('schedules')
        .select('*, class:classes(name), teacher:teachers(first_name, last_name), room:rooms(name)')
        .order('weekday', { ascending: true })
        .order('start_time', { ascending: true });
      if (error) throw error;
      setSchedules((data || []) as ScheduleWithRelations[]);

      const [cRes, tRes, rRes] = await Promise.all([
        supabase.from('classes').select('id, name').in('status', ['confirmada', 'em_andamento']).order('name'),
        supabase.from('teachers').select('id, first_name, last_name').eq('status', 'ativo').order('first_name'),
        supabase.from('rooms').select('id, name').eq('status', 'ativo').order('name'),
      ]);
      setClasses((cRes.data || []) as { id: string; name: string }[]);
      setTeachers((tRes.data || []) as { id: string; first_name: string; last_name: string }[]);
      setRooms((rRes.data || []) as { id: string; name: string }[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar horários');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkConflict = async (
    schedule: Partial<Schedule>,
    excludeId?: string
  ): Promise<{ teacherConflict?: ScheduleWithRelations; roomConflict?: ScheduleWithRelations }> => {
    if (schedule.weekday === undefined || !schedule.start_time || !schedule.end_time) return {};
    let query = supabase
      .from('schedules')
      .select('*, class:classes(name), teacher:teachers(first_name, last_name), room:rooms(name)')
      .eq('weekday', schedule.weekday)
      .neq('status', 'cancelada');
    if (excludeId) query = query.neq('id', excludeId);

    const { data } = await query;
    const entries = (data || []) as ScheduleWithRelations[];

    const sStart = schedule.start_time || '';
    const sEnd = schedule.end_time || '';
    const overlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
      aStart < bEnd && bStart < aEnd;

    const teacherConflict = entries.find(
      (e) => e.teacher_id === schedule.teacher_id && overlap(e.start_time, e.end_time, sStart, sEnd)
    );
    const roomConflict = schedule.room_id
      ? entries.find(
          (e) => e.room_id === schedule.room_id && overlap(e.start_time, e.end_time, sStart, sEnd)
        )
      : undefined;

    return { teacherConflict, roomConflict };
  };

  const handleSave = async (formData: Partial<Schedule>) => {
    try {
      const { teacherConflict, roomConflict } = await checkConflict(formData, editingSchedule?.id);
      if (teacherConflict || roomConflict) {
        const messages: string[] = [];
        if (teacherConflict) {
          messages.push(
            `Conflito de professor: ${teacherConflict.teacher?.first_name} ${teacherConflict.teacher?.last_name} já tem aula ${teacherConflict.class?.name} às ${teacherConflict.start_time}-${teacherConflict.end_time}`
          );
        }
        if (roomConflict) {
          messages.push(
            `Conflito de sala: ${roomConflict.room?.name} já está ocupada com ${roomConflict.class?.name} às ${roomConflict.start_time}-${roomConflict.end_time}`
          );
        }
        if (!confirm(messages.join('\n\n') + '\n\nDeseja salvar mesmo assim?')) return;
      }

      if (editingSchedule) {
        const { id, created_at, ...updateData } = editingSchedule;
        const { error } = await supabase
          .from('schedules')
          .update({ ...formData, room_id: formData.room_id || null })
          .eq('id', id);
        if (error) throw error;
        await logActivity('schedule', 'Horário atualizado', `Aula ${formData.class_id}`, 'schedule', id);
      } else {
        const { data, error } = await supabase
          .from('schedules')
          .insert({ ...formData, room_id: formData.room_id || null })
          .select()
          .single();
        if (error) throw error;
        await logActivity('schedule', 'Horário criado', 'Novo horário de aula', 'schedule', data.id);
      }
      setModalOpen(false);
      setEditingSchedule(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar horário');
    }
  };

  const handleDelete = async (schedule: ScheduleWithRelations) => {
    if (!confirm(`Excluir este horário (${weekdayLabel(schedule.weekday)} ${schedule.start_time}-${schedule.end_time})?`)) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', schedule.id);
      if (error) throw error;
      await logActivity('schedule', 'Horário excluído', 'Horário removido', 'schedule', schedule.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir horário');
    }
  };

  const teacherName = (s: ScheduleWithRelations) =>
    s.teacher ? `${s.teacher.first_name} ${s.teacher.last_name}` : '—';

  const columns: Column<ScheduleWithRelations>[] = [
    {
      key: 'weekday',
      label: 'Dia',
      render: (s) => <span className="text-white/90 font-medium">{weekdayLabel(s.weekday)}</span>,
    },
    {
      key: 'time',
      label: 'Horário',
      render: (s) => (
        <span className="text-white/60 text-xs flex items-center gap-1.5">
          <Clock size={12} /> {s.start_time} — {s.end_time}
        </span>
      ),
    },
    {
      key: 'class',
      label: 'Turma',
      render: (s) => <span className="text-white/70">{s.class?.name || '—'}</span>,
    },
    {
      key: 'teacher',
      label: 'Professor',
      render: (s) => <span className="text-white/60">{teacherName(s)}</span>,
    },
    {
      key: 'room',
      label: 'Sala',
      render: (s) => <span className="text-white/50 text-xs">{s.room?.name || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Situação',
      render: (s) => <StatusBadge status={s.status} />,
    },
  ];

  // Build grid view grouped by weekday
  const weekdayGroups = WEEKDAYS.map((wd) => ({
    ...wd,
    entries: schedules
      .filter((s) => s.weekday === wd.value)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  })).filter((g) => g.value !== 0); // exclude Sunday for typical school week

  const tabs = [
    {
      key: 'grid',
      label: 'Grade Semanal',
      icon: <Grid3x3 size={15} />,
      content: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {weekdayGroups.map((g) => (
            <Card key={g.value}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white/90">{g.label}</h3>
                <Badge variant="neutral">{g.entries.length}</Badge>
              </div>
              {g.entries.length === 0 ? (
                <p className="text-xs text-white/30 py-6 text-center">Nenhuma aula</p>
              ) : (
                <div className="space-y-2">
                  {g.entries.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-lg bg-white/[0.02] border border-edge/subtle hover:border-edge transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-white/80">
                          {s.start_time} — {s.end_time}
                        </span>
                        <button
                          onClick={() => handleDelete(s)}
                          className="p-0.5 text-white/20 hover:text-red-400 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-sm text-white/70">{s.class?.name || '—'}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {teacherName(s)} · {s.room?.name || 'Sem sala'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ),
    },
    {
      key: 'list',
      label: 'Lista',
      icon: <CalendarClock size={15} />,
      content: (
        <DataTable
          columns={columns}
          data={schedules}
          rowKey={(s) => s.id}
          actions={(s) => (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => {
                  setEditingSchedule(s);
                  setModalOpen(true);
                }}
                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                title="Editar"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => handleDelete(s)}
                className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Excluir"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Horários"
        description="Grade de horários semanal da RAYON Academy"
        actions={[
          {
            label: 'Novo Horário',
            icon: <Plus size={16} />,
            onClick: () => {
              setEditingSchedule(null);
              setModalOpen(true);
            },
          },
        ]}
      />

      {loading ? (
        <Card>
          <LoadingState message="Carregando horários..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : schedules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarClock size={32} />}
            title="Nenhum horário cadastrado"
            description="Crie o primeiro horário de aula"
            action={
              <button
                onClick={() => {
                  setEditingSchedule(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Novo Horário
              </button>
            }
          />
        </Card>
      ) : (
        <Card>
          <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        </Card>
      )}

      <ScheduleFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSchedule(null);
        }}
        schedule={editingSchedule}
        classes={classes}
        teachers={teachers}
        rooms={rooms}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// SCHEDULE FORM MODAL
// ============================================================
function ScheduleFormModal({
  open,
  onClose,
  schedule,
  classes,
  teachers,
  rooms,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  schedule: ScheduleWithRelations | null;
  classes: { id: string; name: string }[];
  teachers: { id: string; first_name: string; last_name: string }[];
  rooms: { id: string; name: string }[];
  onSave: (data: Partial<Schedule>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Schedule>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        schedule
          ? {
              class_id: schedule.class_id,
              teacher_id: schedule.teacher_id,
              room_id: schedule.room_id,
              weekday: schedule.weekday,
              start_time: schedule.start_time,
              end_time: schedule.end_time,
              status: schedule.status,
            }
          : {
              class_id: '',
              teacher_id: '',
              room_id: '',
              weekday: 1,
              start_time: '08:00',
              end_time: '09:00',
              status: 'ativo',
            }
      );
    }
  }, [open, schedule]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.class_id || !formData.teacher_id) {
      alert('Turma e professor são obrigatórios');
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
        room_id: formData.room_id || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule ? 'Editar Horário' : 'Novo Horário'}
      description="Defina turma, professor, sala e horário"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <FormField label="Sala">
            <select
              value={formData.room_id || ''}
              onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Sem sala definida</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Dia da Semana" required>
          <select
            value={formData.weekday ?? 1}
            onChange={(e) => setFormData({ ...formData, weekday: Number(e.target.value) })}
            className="input-base w-full"
          >
            {WEEKDAYS.map((wd) => (
              <option key={wd.value} value={wd.value}>
                {wd.label}
              </option>
            ))}
          </select>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <FormField label="Situação">
          <select
            value={formData.status || 'ativo'}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="input-base w-full"
          >
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </FormField>

        <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 flex items-start gap-2.5">
          <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/50">
            O sistema verifica automaticamente conflitos de professor e sala no mesmo dia e horário.
            Você será alertado antes de salvar se houver sobreposição.
          </p>
        </div>

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
