import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { LoadingState, ErrorState, StatusBadge, EmptyState } from '@/components/ui/Feedback';
import {
  UserCog, UserPlus, Search, Pencil, Trash2, Phone, Mail, Users, Save, X, Link2,
} from 'lucide-react';
import type { Guardian, Student, StudentGuardian } from '@/lib/types';

type GuardianWithStudents = Guardian & {
  student_guardians?: (StudentGuardian & { student: Student })[];
};

export function GuardiansPage({ initialSearch }: { initialSearch?: string }) {
  const [guardians, setGuardians] = useState<GuardianWithStudents[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch || '');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<GuardianWithStudents | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkGuardian, setLinkGuardian] = useState<GuardianWithStudents | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('guardians')
        .select('*, student_guardians(*, student:students(*))')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGuardians((data || []) as GuardianWithStudents[]);

      const { data: studentsData } = await supabase
        .from('students')
        .select('*')
        .order('first_name');
      setStudents((studentsData || []) as Student[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar responsaveis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);

  const filtered = guardians.filter((g) => {
    const fullName = `${g.first_name} ${g.last_name}`.toLowerCase();
    return !search || fullName.includes(search.toLowerCase());
  });

  const handleSave = async (formData: Partial<Guardian>) => {
    try {
      if (editingGuardian) {
        const { id, ...updateData } = editingGuardian;
        const { error } = await supabase
          .from('guardians')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        await logActivity('guardian', 'Responsavel atualizado', `${formData.first_name} ${formData.last_name}`, 'guardian', id);
      } else {
        const { data, error } = await supabase
          .from('guardians')
          .insert(formData)
          .select()
          .single();
        if (error) throw error;
        await logActivity('guardian', 'Responsavel cadastrado', `${formData.first_name} ${formData.last_name}`, 'guardian', data.id);
      }
      setModalOpen(false);
      setEditingGuardian(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  };

  const handleDelete = async (g: GuardianWithStudents) => {
    if (!confirm(`Excluir o responsavel ${g.first_name} ${g.last_name}?`)) return;
    try {
      const { error } = await supabase.from('guardians').delete().eq('id', g.id);
      if (error) throw error;
      await logActivity('guardian', 'Responsavel excluido', `${g.first_name} ${g.last_name}`, 'guardian', g.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  };

  const handleLink = async (guardianId: string, studentId: string, relationshipType: string, isPrimary: boolean, isFinancial: boolean) => {
    try {
      const { error } = await supabase
        .from('student_guardians')
        .insert({
          guardian_id: guardianId,
          student_id: studentId,
          relationship_type: relationshipType,
          is_primary: isPrimary,
          is_financial: isFinancial,
        });
      if (error) throw error;
      setLinkModalOpen(false);
      setLinkGuardian(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao vincular');
    }
  };

  const columns: Column<GuardianWithStudents>[] = [
    {
      key: 'name',
      label: 'Nome',
      render: (g) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-edge flex items-center justify-center text-xs font-medium text-white/60">
            {g.first_name.charAt(0)}{g.last_name.charAt(0)}
          </div>
          <span className="text-white/90 font-medium">{g.first_name} {g.last_name}</span>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contato',
      render: (g) => (
        <div className="space-y-0.5">
          {g.phone && <p className="text-xs text-white/50 flex items-center gap-1"><Phone size={11} /> {g.phone}</p>}
          {g.email && <p className="text-xs text-white/50 flex items-center gap-1"><Mail size={11} /> {g.email}</p>}
          {!g.phone && !g.email && <span className="text-white/30">—</span>}
        </div>
      ),
    },
    {
      key: 'students',
      label: 'Alunos Vinculados',
      render: (g) => (
        <span className="text-white/60">
          {g.student_guardians?.length || 0} aluno(s)
        </span>
      ),
    },
    {
      key: 'relationship',
      label: 'Tipo',
      render: (g) => <span className="text-white/60">{g.relationship_type || '—'}</span>,
    },
    {
      key: 'financial',
      label: 'Resp. Financeiro',
      render: (g) => g.is_financial_responsible ? <StatusBadge status="ativo" /> : <span className="text-white/30">Nao</span>,
    },
    {
      key: 'status',
      label: 'Situacao',
      render: (g) => <StatusBadge status={g.status} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Responsaveis"
        description="Cadastre e gerencie os responsaveis pelos alunos"
        actions={[
          { label: 'Novo Responsavel', icon: <UserPlus size={16} />, onClick: () => { setEditingGuardian(null); setModalOpen(true); } },
        ]}
      />

      <Card className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar responsavel..."
            className="input-base w-full pl-9"
          />
        </div>
      </Card>

      <Card>
        {loading ? (
          <LoadingState message="Carregando responsaveis..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UserCog size={32} />}
            title="Nenhum responsavel encontrado"
            description="Cadastre o primeiro responsavel"
            action={<button onClick={() => { setEditingGuardian(null); setModalOpen(true); }} className="btn-primary"><UserPlus size={16} /> Novo Responsavel</button>}
          />
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(g) => g.id}
            actions={(g) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => { setLinkGuardian(g); setLinkModalOpen(true); }}
                  className="p-1.5 rounded-md text-white/40 hover:text-rayon-orange hover:bg-rayon-orange/10 transition-all"
                  title="Vincular aluno"
                >
                  <Link2 size={16} />
                </button>
                <button
                  onClick={() => { setEditingGuardian(g); setModalOpen(true); }}
                  className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/[0.06] transition-all"
                  title="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(g)}
                  className="p-1.5 rounded-md text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          />
        )}
      </Card>

      <GuardianFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditingGuardian(null); }}
        guardian={editingGuardian}
        onSave={handleSave}
      />

      <LinkStudentModal
        open={linkModalOpen}
        onClose={() => { setLinkModalOpen(false); setLinkGuardian(null); }}
        guardian={linkGuardian}
        students={students}
        onLink={handleLink}
      />
    </div>
  );
}

function GuardianFormModal({
  open, onClose, guardian, onSave,
}: {
  open: boolean;
  onClose: () => void;
  guardian: GuardianWithStudents | null;
  onSave: (data: Partial<Guardian>) => void;
}) {
  const [formData, setFormData] = useState<Partial<Guardian>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFormData(
        guardian
          ? {
              first_name: guardian.first_name,
              last_name: guardian.last_name,
              email: guardian.email,
              phone: guardian.phone,
              document_cpf: guardian.document_cpf,
              relationship_type: guardian.relationship_type,
              is_financial_responsible: guardian.is_financial_responsible,
              status: guardian.status,
            }
          : {
              first_name: '', last_name: '', email: '', phone: '',
              document_cpf: '', relationship_type: 'pai_mae',
              is_financial_responsible: false, status: 'ativo',
            }
      );
    }
  }, [open, guardian]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name || !formData.last_name) { alert('Nome e sobrenome sao obrigatorios'); return; }
    setSaving(true);
    try {
      await onSave({
        ...formData,
        is_financial_responsible: formData.is_financial_responsible || false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={guardian ? 'Editar Responsavel' : 'Novo Responsavel'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome" required>
            <input type="text" value={formData.first_name || ''} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="input-base w-full" placeholder="Nome" />
          </FormField>
          <FormField label="Sobrenome" required>
            <input type="text" value={formData.last_name || ''} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="input-base w-full" placeholder="Sobrenome" />
          </FormField>
          <FormField label="Email">
            <input type="email" value={formData.email || ''} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input-base w-full" placeholder="email@exemplo.com" />
          </FormField>
          <FormField label="Telefone">
            <input type="tel" value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input-base w-full" placeholder="(11) 99999-9999" />
          </FormField>
          <FormField label="CPF">
            <input type="text" value={formData.document_cpf || ''} onChange={(e) => setFormData({ ...formData, document_cpf: e.target.value })} className="input-base w-full" placeholder="000.000.000-00" />
          </FormField>
          <FormField label="Tipo de Relacionamento">
            <select value={formData.relationship_type || 'pai_mae'} onChange={(e) => setFormData({ ...formData, relationship_type: e.target.value })} className="input-base w-full">
              <option value="pai_mae">Pai/Mae</option>
              <option value="avo">Avo</option>
              <option value="tio_tia">Tio/Tia</option>
              <option value="irmo">Irmao/Irma</option>
              <option value="tutor">Tutor Legal</option>
              <option value="outro">Outro</option>
            </select>
          </FormField>
          <FormField label="Situacao">
            <select value={formData.status || 'ativo'} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="input-base w-full">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </FormField>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_financial_responsible || false}
                onChange={(e) => setFormData({ ...formData, is_financial_responsible: e.target.checked })}
                className="w-4 h-4 rounded accent-rayon-orange"
              />
              Responsavel Financeiro
            </label>
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

function LinkStudentModal({
  open, onClose, guardian, students, onLink,
}: {
  open: boolean;
  onClose: () => void;
  guardian: GuardianWithStudents | null;
  students: Student[];
  onLink: (guardianId: string, studentId: string, rel: string, isPrimary: boolean, isFinancial: boolean) => void;
}) {
  const [studentId, setStudentId] = useState('');
  const [relType, setRelType] = useState('pai_mae');
  const [isPrimary, setIsPrimary] = useState(false);
  const [isFinancial, setIsFinancial] = useState(false);

  useEffect(() => {
    if (open) { setStudentId(''); setRelType('pai_mae'); setIsPrimary(false); setIsFinancial(false); }
  }, [open]);

  if (!guardian) return null;

  const linkedIds = new Set(guardian.student_guardians?.map((sg) => sg.student_id));
  const available = students.filter((s) => !linkedIds.has(s.id));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) { alert('Selecione um aluno'); return; }
    onLink(guardian.id, studentId, relType, isPrimary, isFinancial);
  };

  return (
    <Modal open={open} onClose={onClose} title="Vincular Aluno" description={`${guardian.first_name} ${guardian.last_name}`} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Aluno" required>
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input-base w-full">
            <option value="">Selecione um aluno</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.code})</option>
            ))}
          </select>
        </FormField>
        <FormField label="Tipo de Relacionamento">
          <select value={relType} onChange={(e) => setRelType(e.target.value)} className="input-base w-full">
            <option value="pai_mae">Pai/Mae</option>
            <option value="avo">Avo</option>
            <option value="tio_tia">Tio/Tia</option>
            <option value="irmo">Irmao/Irma</option>
            <option value="tutor">Tutor Legal</option>
            <option value="outro">Outro</option>
          </select>
        </FormField>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="w-4 h-4 rounded accent-rayon-orange" />
            Responsavel principal
          </label>
          <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
            <input type="checkbox" checked={isFinancial} onChange={(e) => setIsFinancial(e.target.checked)} className="w-4 h-4 rounded accent-rayon-orange" />
            Responsavel financeiro
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-edge">
          <button type="button" onClick={onClose} className="btn-ghost"><X size={16} /> Cancelar</button>
          <button type="submit" className="btn-primary"><Link2 size={16} /> Vincular</button>
        </div>
      </form>
    </Modal>
  );
}
