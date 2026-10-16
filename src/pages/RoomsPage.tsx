import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import { DoorOpen, Plus, Search, Pencil, Trash2, Save, X, MapPin, Users } from 'lucide-react';
import type { Room, Unit } from '@/lib/types';

type RoomWithRelations = Room & {
  unit?: { name: string };
};

export function RoomsPage() {
  const [rooms, setRooms] = useState<RoomWithRelations[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithRelations | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*, unit:units(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRooms((data || []) as RoomWithRelations[]);

      const { data: unitsData } = await supabase.from('units').select('id, name').order('name');
      setUnits(unitsData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar salas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = rooms.filter((r) => {
    const matchesSearch =
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.code || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = async (formData: Partial<Room>) => {
    try {
      if (editingRoom) {
        const { id, created_at, ...updateData } = editingRoom;
        const { error } = await supabase
          .from('rooms')
          .update({ ...formData, unit_id: formData.unit_id || null })
          .eq('id', id);
        if (error) throw error;
        await logActivity('room', 'Sala atualizada', formData.name, 'room', id);
      } else {
        let code = formData.code;
        if (!code) {
          code = await generateCode('SALA', 'rooms');
        }
        const { data, error } = await supabase
          .from('rooms')
          .insert({ ...formData, code, unit_id: formData.unit_id || null })
          .select()
          .single();
        if (error) throw error;
        await logActivity('room', 'Sala cadastrada', formData.name, 'room', data.id);
      }
      setModalOpen(false);
      setEditingRoom(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar sala');
    }
  };

  const handleDelete = async (room: RoomWithRelations) => {
    if (!confirm(`Excluir a sala ${room.name}?`)) return;
    try {
      const { error } = await supabase.from('rooms').delete().eq('id', room.id);
      if (error) throw error;
      await logActivity('room', 'Sala excluída', room.name, 'room', room.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir sala');
    }
  };

  const columns: Column<RoomWithRelations>[] = [
    {
      key: 'name',
      label: 'Sala',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gray-100 border border-edge flex items-center justify-center text-gray-400 shrink-0">
            <DoorOpen size={16} />
          </div>
          <span className="text-gray-800 font-medium">{r.name}</span>
        </div>
      ),
    },
    {
      key: 'code',
      label: 'Código',
      render: (r) => <span className="text-xs text-gray-400 font-mono">{r.code || '—'}</span>,
    },
    {
      key: 'capacity',
      label: 'Capacidade',
      render: (r) => (
        <span className="text-gray-500 flex items-center gap-1.5">
          <Users size={14} /> {r.capacity}
        </span>
      ),
    },
    {
      key: 'unit',
      label: 'Unidade',
      render: (r) =>
        r.unit ? (
          <span className="text-gray-400 text-xs flex items-center gap-1.5">
            <MapPin size={12} /> {r.unit.name}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Situação',
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Salas"
        description="Gerencie os espaços físicos da RAYON Academy"
        actions={[
          {
            label: 'Nova Sala',
            icon: <Plus size={16} />,
            onClick: () => {
              setEditingRoom(null);
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
              placeholder="Buscar por nome ou código..."
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
            <option value="manutencao">Manutenção</option>
          </select>
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando salas..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<DoorOpen size={32} />}
            title="Nenhuma sala encontrada"
            description="Cadastre a primeira sala para começar"
            action={
              <button
                onClick={() => {
                  setEditingRoom(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Nova Sala
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(r) => r.id}
            actions={(r) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => {
                    setEditingRoom(r);
                    setModalOpen(true);
                  }}
                  className="p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(r)}
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

      <RoomFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRoom(null);
        }}
        room={editingRoom}
        units={units}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// ROOM FORM MODAL
// ============================================================
function RoomFormModal({
  open,
  onClose,
  room,
  units,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  room: RoomWithRelations | null;
  units: { id: string; name: string }[];
  onSave: (data: Partial<Room>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Room>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        room
          ? {
              name: room.name,
              code: room.code || '',
              capacity: room.capacity,
              unit_id: room.unit_id,
              status: room.status,
            }
          : {
              name: '',
              code: '',
              capacity: 20,
              unit_id: '',
              status: 'ativo',
            }
      );
    }
  }, [open, room]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Nome é obrigatório');
      return;
    }
    if (!formData.capacity || formData.capacity < 1) {
      alert('Capacidade deve ser maior que zero');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        capacity: Number(formData.capacity) || 20,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={room ? 'Editar Sala' : 'Nova Sala'}
      description={room ? room.name : 'Defina nome, capacidade e unidade'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome da Sala" required>
          <input
            type="text"
            value={formData.name || ''}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-base w-full"
            placeholder="Ex: Sala 101 — Auditório"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Código" hint="Gerado automaticamente se vazio">
            <input
              type="text"
              value={formData.code || ''}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="input-base w-full"
              placeholder="Ex: SALA-00001"
            />
          </FormField>
          <FormField label="Capacidade" required>
            <input
              type="number"
              value={formData.capacity || ''}
              onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
              className="input-base w-full"
              min="1"
              placeholder="20"
            />
          </FormField>
        </div>

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
              <option value="manutencao">Manutenção</option>
            </select>
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
