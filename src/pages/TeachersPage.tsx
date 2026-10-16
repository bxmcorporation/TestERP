import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import {
  GraduationCap, UserPlus, Search, Pencil, Trash2, Mail, Phone,
  Save, X, Plus,
} from 'lucide-react';
import type { Teacher, Unit } from '@/lib/types';

type TeacherWithRelations = Teacher & {
  unit?: { name: string };
  classCount?: number;
};

export function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherWithRelations[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<TeacherWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('teachers')
        .select('*, unit:units(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        ((data || []) as TeacherWithRelations[]).map(async (t) => {
          const { count } = await supabase
            .from('class_teachers')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', t.id);
          return { ...t, classCount: count || 0 };
        })
      );
      setTeachers(enriched);

      const { data: unitsData } = await supabase.from('units').select('id, name').order('name');
      setUnits(unitsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar professores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = teachers.filter((t) => {
    const fullName = `${t.first_name} ${t.last_name}`.toLowerCase();
    const matchesSearch =
      !search ||
      fullName.includes(search.toLowerCase()) ||
      (t.specialty || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async (formData: Partial<Teacher>) => {
    try {
      if (editingTeacher) {
        const { id, created_at, updated_at, classCount, ...updateData } = editingTeacher;
        const { error } = await supabase
          .from('teachers')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity(
          'teacher',
          'Professor atualizado',
          `${formData.first_name} ${formData.last_name}`,
          'teacher',
          id
        );
      } else {
        const { data, error } = await supabase
          .from('teachers')
          .insert(formData)
          .select()
          .single();
        if (error) throw error;
        await logActivity(
          'teacher',
          'Professor cadastrado',
          `${formData.first_name} ${formData.last_name}`,
          'teacher',
          data.id
        );
      }
      setModalOpen(false);
      setEditingTeacher(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar professor');
    }
  };

  const handleDelete = async (teacher: TeacherWithRelations) => {
    if (teacher.classCount && teacher.classCount > 0) {
      alert('Não é possível excluir um professor com turmas vinculadas');
      return;
    }
    if (!confirm(`Excluir o professor ${teacher.first_name} ${teacher.last_name}?`)) return;
    try {
      const { error } = await supabase.from('teachers').delete().eq('id', teacher.id);
      if (error) throw error;
      await logActivity(
        'teacher',
        'Professor excluído',
        `${teacher.first_name} ${teacher.last_name}`,
        'teacher',
        teacher.id
      );
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir professor');
    }
  };

  const columns: Column<TeacherWithRelations>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center text-xs font-medium text-rayon-orange shrink-0">
            {t.first_name.charAt(0)}
            {t.last_name.charAt(0)}
          </div>
          <span className="text-gray-800 font-medium">
            {t.first_name} {t.last_name}
          </span>
        </div>
      ),
    },
    {
      key: 'specialty',
      label: 'Especialidade',
      render: (t) => <span className="text-gray-500">{t.specialty || '—'}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      render: (t) =>
        t.email ? (
          <span className="text-gray-500 text-xs flex items-center gap-1.5">
            <Mail size={12} /> {t.email}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'phone',
      label: 'Telefone',
      render: (t) =>
        t.phone ? (
          <span className="text-gray-500 text-xs flex items-center gap-1.5">
            <Phone size={12} /> {t.phone}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'classes',
      label: 'Turmas',
      render: (t) => <span className="text-gray-500">{t.classCount || 0}</span>,
    },
    {
      key: 'status',
      label: 'Situação',
      render: (t) => <StatusBadge status={t.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Professores"
        description="Gerencie o corpo docente da RAYON Academy"
        actions={[
          {
            label: 'Novo Professor',
            icon: <UserPlus size={16} />,
            onClick: () => {
              setEditingTeacher(null);
              setModalOpen(true);
            },
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
              placeholder="Buscar por nome ou especialidade..."
              className="input-base w-full pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base sm:w-48"
          >
            <option value="all">Todas as situações</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="licenca">Licença</option>
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando professores..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={32} />}
            title="Nenhum professor encontrado"
            description="Cadastre o primeiro professor para começar"
            action={
              <button
                onClick={() => {
                  setEditingTeacher(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <UserPlus size={16} /> Novo Professor
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(t) => t.id}
            actions={(t) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => {
                    setEditingTeacher(t);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(t)}
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

      <TeacherFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingTeacher(null);
        }}
        teacher={editingTeacher}
        units={units}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// TEACHER FORM MODAL
// ============================================================
function TeacherFormModal({
  open,
  onClose,
  teacher,
  units,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  teacher: TeacherWithRelations | null;
  units: { id: string; name: string }[];
  onSave: (data: Partial<Teacher>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Teacher> & { availabilityList?: string[] }>({});
  const [availabilityInput, setAvailabilityInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const availList = Array.isArray(teacher?.availability)
        ? (teacher.availability as string[])
        : [];
      setFormData(
        teacher
          ? {
              first_name: teacher.first_name,
              last_name: teacher.last_name,
              email: teacher.email,
              phone: teacher.phone,
              specialty: teacher.specialty,
              hire_date: teacher.hire_date,
              status: teacher.status,
              unit_id: teacher.unit_id,
              availabilityList: availList,
            }
          : {
              first_name: '',
              last_name: '',
              email: '',
              phone: '',
              specialty: '',
              hire_date: '',
              status: 'ativo',
              unit_id: '',
              availabilityList: [],
            }
      );
      setAvailabilityInput('');
    }
  }, [open, teacher]);

  const addAvailability = () => {
    const value = availabilityInput.trim();
    if (!value) return;
    const current = formData.availabilityList || [];
    if (current.includes(value)) {
      setAvailabilityInput('');
      return;
    }
    setFormData({ ...formData, availabilityList: [...current, value] });
    setAvailabilityInput('');
  };

  const removeAvailability = (item: string) => {
    setFormData({
      ...formData,
      availabilityList: (formData.availabilityList || []).filter((a) => a !== item),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) {
      alert('Nome e sobrenome são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const { availabilityList, ...rest } = formData;
      await onSave({
        ...rest,
        unit_id: formData.unit_id || null,
        hire_date: formData.hire_date || null,
        availability: availabilityList || [],
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={teacher ? 'Editar Professor' : 'Novo Professor'}
      description={
        teacher
          ? `${teacher.first_name} ${teacher.last_name}`
          : 'Preencha os dados do professor'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Dados Pessoais
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Nome" required>
              <input
                type="text"
                value={formData.first_name || ''}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="input-base w-full"
                placeholder="Nome do professor"
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
            <FormField label="Especialidade">
              <input
                type="text"
                value={formData.specialty || ''}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                className="input-base w-full"
                placeholder="Ex: Comunicação e Oratória"
              />
            </FormField>
            <FormField label="Data de Contratação">
              <input
                type="date"
                value={formData.hire_date || ''}
                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                className="input-base w-full"
              />
            </FormField>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Vínculo e Situação
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Unidade">
              <select
                value={formData.unit_id || ''}
                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
                className="input-base w-full"
              >
                <option value="">Selecione uma unidade</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Situação">
              <select
                value={formData.status || 'ativo'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="input-base w-full"
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
                <option value="licenca">Licença</option>
              </select>
            </FormField>
          </div>
        </div>

        <div>
          <FormField
            label="Disponibilidade"
            hint="Adicione horários ou dias disponíveis (ex: Segunda Manhã, Terça Tarde)"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={availabilityInput}
                onChange={(e) => setAvailabilityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAvailability();
                  }
                }}
                className="input-base w-full"
                placeholder="Digite e pressione Enter para adicionar"
              />
              <button
                type="button"
                onClick={addAvailability}
                className="btn-ghost shrink-0"
              >
                <Plus size={16} /> Adicionar
              </button>
            </div>
            {(formData.availabilityList || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(formData.availabilityList || []).map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 border border-edge text-xs text-gray-600"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeAvailability(item)}
                      className="text-gray-300 hover:text-red-600"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </FormField>
        </div>

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
