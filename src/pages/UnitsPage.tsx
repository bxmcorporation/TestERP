import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import {
  Building2, Plus, Search, Pencil, Trash2, Save, X, Mail, Phone, MapPin,
} from 'lucide-react';
import type { Unit } from '@/lib/types';

type UnitWithCounts = Unit & {
  studentCount?: number;
  teacherCount?: number;
};

export function UnitsPage() {
  const [units, setUnits] = useState<UnitWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitWithCounts | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');
      if (error) throw error;

      const enriched = await Promise.all(
        ((data || []) as Unit[]).map(async (u) => {
          const [sRes, tRes] = await Promise.all([
            supabase.from('students').select('*', { count: 'exact', head: true }).eq('unit_id', u.id),
            supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('unit_id', u.id),
          ]);
          return { ...u, studentCount: sRes.count || 0, teacherCount: tRes.count || 0 };
        })
      );
      setUnits(enriched);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = units.filter((u) => {
    const matchesSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.code || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.city || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async (formData: Partial<Unit>) => {
    try {
      if (editingUnit) {
        const { id, created_at, updated_at, studentCount, teacherCount, ...updateData } = editingUnit;
        const { error } = await supabase
          .from('units')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity('unit', 'Unidade atualizada', formData.name, 'unit', id);
      } else {
        let code = formData.code;
        if (!code) {
          code = await generateCode('UNI', 'units');
        }
        const { data, error } = await supabase
          .from('units')
          .insert({ ...formData, code })
          .select()
          .single();
        if (error) throw error;
        await logActivity('unit', 'Unidade cadastrada', formData.name, 'unit', data.id);
      }
      setModalOpen(false);
      setEditingUnit(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar unidade');
    }
  };

  const handleDelete = async (unit: UnitWithCounts) => {
    if ((unit.studentCount || 0) > 0 || (unit.teacherCount || 0) > 0) {
      alert('Não é possível excluir uma unidade com alunos ou professores vinculados');
      return;
    }
    if (!confirm(`Excluir a unidade ${unit.name}?`)) return;
    try {
      const { error } = await supabase.from('units').delete().eq('id', unit.id);
      if (error) throw error;
      await logActivity('unit', 'Unidade excluída', unit.name, 'unit', unit.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir unidade');
    }
  };

  const columns: Column<UnitWithCounts>[] = [
    {
      key: 'name',
      label: 'Unidade',
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 shrink-0">
            <Building2 size={16} />
          </div>
          <div>
            <span className="text-gray-800 font-medium">{u.name}</span>
            <p className="text-xs text-gray-400 font-mono">{u.code}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Cidade/Estado',
      render: (u) =>
        u.city ? (
          <span className="text-gray-500 text-xs flex items-center gap-1.5">
            <MapPin size={12} /> {u.city}/{u.state || '—'}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'students',
      label: 'Alunos',
      render: (u) => <span className="text-gray-500">{u.studentCount || 0}</span>,
    },
    {
      key: 'teachers',
      label: 'Professores',
      render: (u) => <span className="text-gray-500">{u.teacherCount || 0}</span>,
    },
    {
      key: 'status',
      label: 'Situação',
      render: (u) => <StatusBadge status={u.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Unidades"
        description="Gerencie as unidades da RAYON Academy"
        actions={[
          {
            label: 'Nova Unidade',
            icon: <Plus size={16} />,
            onClick: () => {
              setEditingUnit(null);
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
              placeholder="Buscar por nome, código ou cidade..."
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
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando unidades..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 size={32} />}
            title="Nenhuma unidade encontrada"
            description="Cadastre a primeira unidade para começar"
            action={
              <button
                onClick={() => {
                  setEditingUnit(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Nova Unidade
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(u) => u.id}
            actions={(u) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => {
                    setEditingUnit(u);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(u)}
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

      <UnitFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUnit(null);
        }}
        unit={editingUnit}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// UNIT FORM MODAL
// ============================================================
function UnitFormModal({
  open,
  onClose,
  unit,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  unit: UnitWithCounts | null;
  onSave: (data: Partial<Unit>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Unit>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        unit
          ? {
              name: unit.name,
              code: unit.code,
              address: unit.address,
              city: unit.city,
              state: unit.state,
              phone: unit.phone,
              email: unit.email,
              status: unit.status,
            }
          : {
              name: '',
              code: '',
              address: '',
              city: '',
              state: '',
              phone: '',
              email: '',
              status: 'ativo',
            }
      );
    }
  }, [open, unit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        address: formData.address || null,
        city: formData.city || null,
        state: formData.state || null,
        phone: formData.phone || null,
        email: formData.email || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={unit ? 'Editar Unidade' : 'Nova Unidade'}
      description={unit ? unit.name : 'Preencha os dados da unidade'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome" required>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-base w-full"
              placeholder="Ex: RAYON Academy — São Paulo"
            />
          </FormField>
          <FormField label="Código" hint="Gerado automaticamente se vazio">
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input-base w-full"
              placeholder="Ex: UNI-00001"
            />
          </FormField>
        </div>

        <FormField label="Endereço">
          <input
            type="text"
            value={formData.address || ''}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="input-base w-full"
            placeholder="Rua, número, complemento..."
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Cidade">
            <input
              type="text"
              value={formData.city || ''}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="input-base w-full"
              placeholder="São Paulo"
            />
          </FormField>
          <FormField label="Estado">
            <input
              type="text"
              value={formData.state || ''}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="input-base w-full"
              placeholder="SP"
              maxLength={2}
            />
          </FormField>
          <FormField label="Situação">
            <select
              value={formData.status || 'ativo'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input-base w-full"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Telefone">
            <input
              type="tel"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input-base w-full"
              placeholder="(11) 99999-9999"
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input-base w-full"
              placeholder="unidade@rayon.com"
            />
          </FormField>
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
