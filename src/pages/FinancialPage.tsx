import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity, generateCode } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState, Badge } from '@/components/ui/Feedback';
import { Tabs } from '@/components/ui/Tabs';
import {
  Wallet, Plus, Search, Pencil, Trash2, Save, X, CheckCircle, TrendingUp,
  TrendingDown, Clock, AlertTriangle, DollarSign,
} from 'lucide-react';
import type { FinancialItem, Student, Unit } from '@/lib/types';

const FINANCIAL_STATUS_OPTIONS = [
  { value: 'em_aberto', label: 'Em aberto' },
  { value: 'pago', label: 'Pago' },
  { value: 'vencido', label: 'Vencido' },
  { value: 'cancelado', label: 'Cancelado' },
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

type FinancialItemWithRelations = FinancialItem & {
  student?: { first_name: string; last_name: string };
  unit?: { name: string };
};

type DashboardStats = {
  totalReceita: number;
  totalDespesa: number;
  emAberto: number;
  vencido: number;
};

export function FinancialPage() {
  const [items, setItems] = useState<FinancialItemWithRelations[]>([]);
  const [students, setStudents] = useState<{ id: string; first_name: string; last_name: string }[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FinancialItemWithRelations | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('financial_items')
        .select('*, student:students(first_name, last_name), unit:units(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data || []) as FinancialItemWithRelations[]);

      const [sRes, uRes] = await Promise.all([
        supabase.from('students').select('id, first_name, last_name').order('first_name'),
        supabase.from('units').select('id, name').order('name'),
      ]);
      setStudents((sRes.data || []) as { id: string; first_name: string; last_name: string }[]);
      setUnits((uRes.data || []) as { id: string; name: string }[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lançamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats: DashboardStats = {
    totalReceita: items
      .filter((i) => i.type === 'receita' && i.status === 'pago')
      .reduce((sum, i) => sum + Number(i.amount), 0),
    totalDespesa: items
      .filter((i) => i.type === 'despesa' && i.status === 'pago')
      .reduce((sum, i) => sum + Number(i.amount), 0),
    emAberto: items
      .filter((i) => i.type === 'receita' && i.status === 'em_aberto')
      .reduce((sum, i) => sum + Number(i.amount), 0),
    vencido: items
      .filter((i) => i.type === 'receita' && i.status === 'vencido')
      .reduce((sum, i) => sum + Number(i.amount), 0),
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      !search ||
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      (i.code || '').toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || i.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const receitas = filtered.filter((i) => i.type === 'receita');
  const despesas = filtered.filter((i) => i.type === 'despesa');

  const handleSave = async (formData: Partial<FinancialItem>) => {
    try {
      if (editingItem) {
        const { id, created_at, updated_at, student, unit, ...updateData } = editingItem;
        const { error } = await supabase
          .from('financial_items')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity('financial', 'Lançamento atualizado', formData.description, 'financial', id);
      } else {
        const code = await generateCode('FIN', 'financial_items');
        const { data, error } = await supabase
          .from('financial_items')
          .insert({ ...formData, code })
          .select()
          .single();
        if (error) throw error;
        await logActivity('financial', 'Lançamento criado', formData.description, 'financial', data.id);
      }
      setModalOpen(false);
      setEditingItem(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar lançamento');
    }
  };

  const handleDelete = async (item: FinancialItemWithRelations) => {
    if (!confirm(`Excluir o lançamento "${item.description}"?`)) return;
    try {
      const { error } = await supabase.from('financial_items').delete().eq('id', item.id);
      if (error) throw error;
      await logActivity('financial', 'Lançamento excluído', item.description, 'financial', item.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  };

  const handleStatusChange = async (item: FinancialItemWithRelations, newStatus: string) => {
    try {
      const updateData: Partial<FinancialItem> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'pago' && !item.paid_date) {
        updateData.paid_date = new Date().toISOString().slice(0, 10);
      }
      const { error } = await supabase.from('financial_items').update(updateData).eq('id', item.id);
      if (error) throw error;
      await logActivity('financial', 'Status atualizado', `${item.description}: ${newStatus}`, 'financial', item.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar status');
    }
  };

  const markAsPaid = (item: FinancialItemWithRelations) => handleStatusChange(item, 'pago');

  const columns: Column<FinancialItemWithRelations>[] = [
    {
      key: 'description',
      label: 'Descrição',
      render: (i) => (
        <div>
          <span className="text-white/90 font-medium">{i.description}</span>
          <p className="text-xs text-white/30 font-mono mt-0.5">{i.code}</p>
          {i.student && (
            <p className="text-xs text-white/40 mt-0.5">
              {i.student.first_name} {i.student.last_name}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      label: 'Tipo',
      render: (i) =>
        i.type === 'receita' ? (
          <Badge variant="success">
            <TrendingUp size={12} className="mr-1" /> Receita
          </Badge>
        ) : (
          <Badge variant="error">
            <TrendingDown size={12} className="mr-1" /> Despesa
          </Badge>
        ),
    },
    {
      key: 'category',
      label: 'Categoria',
      render: (i) => <span className="text-white/50 text-xs">{i.category || '—'}</span>,
    },
    {
      key: 'amount',
      label: 'Valor',
      render: (i) => (
        <span
          className={`font-medium ${i.type === 'receita' ? 'text-green-400' : 'text-red-400'}`}
        >
          {i.type === 'receita' ? '+' : '-'} {formatBRL(Number(i.amount))}
        </span>
      ),
    },
    {
      key: 'due_date',
      label: 'Vencimento',
      render: (i) =>
        i.due_date ? (
          <span className="text-white/50 text-xs">{new Date(i.due_date).toLocaleDateString('pt-BR')}</span>
        ) : (
          <span className="text-white/30">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Situação',
      render: (i) => <StatusBadge status={i.status} />,
    },
  ];

  const renderTable = (data: FinancialItemWithRelations[]) =>
    data.length === 0 ? (
      <EmptyState
        icon={<Wallet size={28} />}
        title="Nenhum lançamento"
        description="Não há lançamentos nesta categoria"
      />
    ) : (
      <DataTable
        columns={columns}
        data={data}
        rowKey={(i) => i.id}
        actions={(i) => (
          <div className="flex items-center justify-end gap-1">
            {i.status === 'em_aberto' && (
              <button
                onClick={() => markAsPaid(i)}
                className="p-1.5 rounded-md text-green-400/60 hover:text-green-400 hover:bg-green-500/10 transition-all"
                title="Marcar como pago"
              >
                <CheckCircle size={16} />
              </button>
            )}
            <select
              value={i.status}
              onChange={(e) => handleStatusChange(i, e.target.value)}
              className="input-base text-xs py-1 !w-28"
              onClick={(e) => e.stopPropagation()}
            >
              {FINANCIAL_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                setEditingItem(i);
                setModalOpen(true);
              }}
              className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
              title="Editar"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => handleDelete(i)}
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
      key: 'all',
      label: `Todos (${filtered.length})`,
      icon: <Wallet size={15} />,
      content: renderTable(filtered),
    },
    {
      key: 'receita',
      label: `Receitas (${receitas.length})`,
      icon: <TrendingUp size={15} />,
      content: renderTable(receitas),
    },
    {
      key: 'despesa',
      label: `Despesas (${despesas.length})`,
      icon: <TrendingDown size={15} />,
      content: renderTable(despesas),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Gestão financeira demonstrativa da RAYON Academy"
        actions={[
          {
            label: 'Novo Lançamento',
            icon: <Plus size={16} />,
            onClick: () => {
              setEditingItem(null);
              setModalOpen(true);
            },
          },
        ]}
      />

      {/* Dashboard cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-green-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
              <TrendingUp size={18} />
            </div>
            <span className="text-xs text-white/40">Receita</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">{formatBRL(stats.totalReceita)}</p>
          <p className="text-xs text-white/30 mt-1">Total recebido</p>
        </Card>

        <Card className="border-red-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <TrendingDown size={18} />
            </div>
            <span className="text-xs text-white/40">Despesa</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">{formatBRL(stats.totalDespesa)}</p>
          <p className="text-xs text-white/30 mt-1">Total pago</p>
        </Card>

        <Card className="border-yellow-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">
              <Clock size={18} />
            </div>
            <span className="text-xs text-white/40">Em aberto</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">{formatBRL(stats.emAberto)}</p>
          <p className="text-xs text-white/30 mt-1">A receber</p>
        </Card>

        <Card className="border-orange-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-rayon-orange/10 border border-rayon-orange/20 text-rayon-orange">
              <AlertTriangle size={18} />
            </div>
            <span className="text-xs text-white/40">Vencido</span>
          </div>
          <p className="text-2xl font-display font-bold text-white">{formatBRL(stats.vencido)}</p>
          <p className="text-xs text-white/30 mt-1">Em atraso</p>
        </Card>
      </div>

      {/* Balance */}
      <Card className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rayon-orange/10 border border-rayon-orange/20 text-rayon-orange">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs text-white/40">Saldo demonstrativo</p>
              <p className="text-xl font-display font-bold text-white">
                {formatBRL(stats.totalReceita - stats.totalDespesa)}
              </p>
            </div>
          </div>
          <Badge variant={stats.totalReceita - stats.totalDespesa >= 0 ? 'success' : 'error'}>
            {stats.totalReceita - stats.totalDespesa >= 0 ? 'Positivo' : 'Negativo'}
          </Badge>
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por descrição ou código..."
              className="input-base w-full pl-9"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="input-base sm:w-40"
          >
            <option value="all">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-base sm:w-40"
          >
            <option value="all">Todas as situações</option>
            {FINANCIAL_STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card>
          <LoadingState message="Carregando lançamentos..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wallet size={32} />}
            title="Nenhum lançamento encontrado"
            description="Crie o primeiro lançamento financeiro"
            action={
              <button
                onClick={() => {
                  setEditingItem(null);
                  setModalOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={16} /> Novo Lançamento
              </button>
            }
          />
        </Card>
      ) : (
        <Card>
          <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        </Card>
      )}

      <FinancialFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        item={editingItem}
        students={students}
        units={units}
        onSave={handleSave}
      />
    </div>
  );
}

// ============================================================
// FINANCIAL FORM MODAL
// ============================================================
function FinancialFormModal({
  open,
  onClose,
  item,
  students,
  units,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  item: FinancialItemWithRelations | null;
  students: { id: string; first_name: string; last_name: string }[];
  units: { id: string; name: string }[];
  onSave: (data: Partial<FinancialItem>) => void;
}) {
  const [formData, setFormData] = useState<Partial<FinancialItem>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        item
          ? {
              description: item.description,
              type: item.type,
              category: item.category,
              amount: item.amount,
              due_date: item.due_date,
              status: item.status,
              student_id: item.student_id,
              unit_id: item.unit_id,
              notes: item.notes,
            }
          : {
              description: '',
              type: 'receita',
              category: '',
              amount: 0,
              due_date: '',
              status: 'em_aberto',
              student_id: '',
              unit_id: '',
              notes: '',
            }
      );
    }
  }, [open, item]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description) {
      alert('Descrição é obrigatória');
      return;
    }
    if (formData.amount === undefined || formData.amount === null || Number(formData.amount) <= 0) {
      alert('Valor deve ser maior que zero');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        amount: Number(formData.amount) || 0,
        category: formData.category || null,
        due_date: formData.due_date || null,
        student_id: formData.student_id || null,
        unit_id: formData.unit_id || null,
        notes: formData.notes || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Editar Lançamento' : 'Novo Lançamento'}
      description={item ? item.code : 'Código será gerado automaticamente (FIN-####)'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Descrição" required>
          <input
            type="text"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="input-base w-full"
            placeholder="Ex: Mensalidade Janeiro 2026"
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Tipo" required>
            <select
              value={formData.type || 'receita'}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="input-base w-full"
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </FormField>
          <FormField label="Categoria">
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="input-base w-full"
              placeholder="Ex: Mensalidade, Material, Salários"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="Valor (R$)" required>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
              className="input-base w-full"
              placeholder="0,00"
            />
          </FormField>
          <FormField label="Vencimento">
            <input
              type="date"
              value={formData.due_date || ''}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="input-base w-full"
            />
          </FormField>
          <FormField label="Situação">
            <select
              value={formData.status || 'em_aberto'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input-base w-full"
            >
              {FINANCIAL_STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Aluno (opcional)">
            <select
              value={formData.student_id || ''}
              onChange={(e) => setFormData({ ...formData, student_id: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Nenhum</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Unidade (opcional)">
            <select
              value={formData.unit_id || ''}
              onChange={(e) => setFormData({ ...formData, unit_id: e.target.value })}
              className="input-base w-full"
            >
              <option value="">Nenhuma</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Observações">
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="input-base w-full min-h-[60px] resize-y"
            placeholder="Notas adicionais..."
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
