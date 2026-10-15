import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { logActivity } from '@/lib/helpers';
import { PageHeader, Card, FormField } from '@/components/ui/PageHeader';
import { LoadingState, ErrorState, StatusBadge, EmptyState, Spinner } from '@/components/ui/Feedback';
import {
  ClipboardCheck, Check, X, Clock as ClockIcon, AlertCircle, Save, History,
} from 'lucide-react';
import type { Lesson, Student, Attendance, Class } from '@/lib/types';

const ATTENDANCE_STATUSES = [
  { value: 'presente', label: 'Presente', color: 'green', icon: Check },
  { value: 'ausente', label: 'Ausente', color: 'red', icon: X },
  { value: 'justificado', label: 'Justificado', color: 'yellow', icon: AlertCircle },
  { value: 'pendente', label: 'Pendente', color: 'gray', icon: ClockIcon },
] as const;

type LessonWithRelations = Lesson & {
  class?: { name: string };
  teacher?: { first_name: string; last_name: string };
};

type AttendanceRecord = {
  student: Student;
  status: string;
  attendanceId?: string;
};

type HistoryItem = Lesson & {
  class?: { name: string };
  attendance?: { status: string }[];
};

export function AttendancePage() {
  const [lessons, setLessons] = useState<LessonWithRelations[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<LessonWithRelations | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

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

      // Load history for recent lessons
      const { data: histData } = await supabase
        .from('lessons')
        .select('*, class:classes(name), attendance(status)')
        .order('lesson_date', { ascending: false })
        .limit(10);
      setHistory((histData || []) as HistoryItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar aulas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadRecords = useCallback(async (lessonId: string) => {
    setLoadingRecords(true);
    try {
      // Get lesson with class info
      const { data: lessonData } = await supabase
        .from('lessons')
        .select('*, class:classes(name), teacher:teachers(first_name, last_name)')
        .eq('id', lessonId)
        .maybeSingle();
      setSelectedLesson(lessonData as LessonWithRelations | null);

      if (!lessonData) {
        setRecords([]);
        return;
      }

      // Get students in this class
      const { data: csData } = await supabase
        .from('class_students')
        .select('student:students(*)')
        .eq('class_id', (lessonData as Lesson).class_id)
        .order('student.first_name');

      const students = ((csData || []) as unknown as { student: Student }[]).map((cs) => cs.student);

      // Get existing attendance
      const { data: attData } = await supabase
        .from('attendance')
        .select('id, student_id, status')
        .eq('lesson_id', lessonId);

      const attMap = new Map(
        ((attData || []) as Attendance[]).map((a) => [a.student_id, a])
      );

      const recs: AttendanceRecord[] = students.map((student) => {
        const existing = attMap.get(student.id);
        return {
          student,
          status: existing?.status || 'pendente',
          attendanceId: existing?.id,
        };
      });

      setRecords(recs);
    } catch {
      setRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLessonId) {
      loadRecords(selectedLessonId);
    } else {
      setSelectedLesson(null);
      setRecords([]);
    }
  }, [selectedLessonId, loadRecords]);

  const setStatus = (studentId: string, status: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, status } : r))
    );
  };

  const handleSave = async () => {
    if (!selectedLessonId || records.length === 0) return;
    setSaving(true);
    setSavedMessage(false);
    try {
      const updates: Promise<void>[] = records.map((r) => {
        if (r.attendanceId) {
          return (async () => {
            const { error } = await supabase
              .from('attendance')
              .update({ status: r.status, recorded_at: new Date().toISOString() })
              .eq('id', r.attendanceId);
            if (error) throw error;
          })();
        }
        return (async () => {
          const { error } = await supabase.from('attendance').insert({
            lesson_id: selectedLessonId,
            student_id: r.student.id,
            status: r.status,
          });
          if (error) throw error;
        })();
      });

      await Promise.all(updates);
      await logActivity(
        'attendance',
        'Frequência registrada',
        `${records.length} registros para ${selectedLesson?.class?.name || 'turma'}`,
        'lesson',
        selectedLessonId
      );
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
      // Reload records to get fresh IDs
      loadRecords(selectedLessonId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar frequência');
    } finally {
      setSaving(false);
    }
  };

  const statusStats = {
    presente: records.filter((r) => r.status === 'presente').length,
    ausente: records.filter((r) => r.status === 'ausente').length,
    justificado: records.filter((r) => r.status === 'justificado').length,
    pendente: records.filter((r) => r.status === 'pendente').length,
  };

  const teacherName = selectedLesson?.teacher
    ? `${selectedLesson.teacher.first_name} ${selectedLesson.teacher.last_name}`
    : '—';

  return (
    <div>
      <PageHeader
        title="Frequência"
        description="Registre a frequência dos alunos nas aulas"
      />

      {loading ? (
        <Card>
          <LoadingState message="Carregando aulas..." />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={load} />
        </Card>
      ) : (
        <>
          {/* Lesson selector */}
          <Card className="mb-4">
            <FormField label="Selecione a aula">
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="input-base w-full"
              >
                <option value="">Selecione uma aula...</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title} — {l.class?.name || 'Sem turma'} ({new Date(l.lesson_date).toLocaleDateString('pt-BR')})
                  </option>
                ))}
              </select>
            </FormField>
          </Card>

          {selectedLessonId && (
            <>
              {/* Lesson info */}
              {selectedLesson && (
                <Card className="mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white/90">{selectedLesson.title}</h3>
                      <p className="text-xs text-white/40 mt-0.5">
                        {selectedLesson.class?.name} · {teacherName} ·{' '}
                        {new Date(selectedLesson.lesson_date).toLocaleDateString('pt-BR')} ·{' '}
                        {selectedLesson.start_time}—{selectedLesson.end_time}
                      </p>
                    </div>
                    <StatusBadge status={selectedLesson.status} />
                  </div>
                </Card>
              )}

              {/* Stats */}
              {records.length > 0 && (
                <div className="grid grid-cols-4 gap-3 mb-4">
                  <Card className="text-center !p-3">
                    <p className="text-xl font-display font-bold text-green-400">{statusStats.presente}</p>
                    <p className="text-xs text-white/40 mt-0.5">Presentes</p>
                  </Card>
                  <Card className="text-center !p-3">
                    <p className="text-xl font-display font-bold text-red-400">{statusStats.ausente}</p>
                    <p className="text-xs text-white/40 mt-0.5">Ausentes</p>
                  </Card>
                  <Card className="text-center !p-3">
                    <p className="text-xl font-display font-bold text-yellow-400">{statusStats.justificado}</p>
                    <p className="text-xs text-white/40 mt-0.5">Justificados</p>
                  </Card>
                  <Card className="text-center !p-3">
                    <p className="text-xl font-display font-bold text-white/40">{statusStats.pendente}</p>
                    <p className="text-xs text-white/40 mt-0.5">Pendentes</p>
                  </Card>
                </div>
              )}

              {/* Attendance list */}
              <Card>
                {loadingRecords ? (
                  <LoadingState message="Carregando alunos..." />
                ) : records.length === 0 ? (
                  <EmptyState
                    icon={<ClipboardCheck size={28} />}
                    title="Nenhum aluno matriculado"
                    description="Esta turma não tem alunos associados"
                  />
                ) : (
                  <div className="space-y-2">
                    {records.map((r) => (
                      <div
                        key={r.student.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-white/[0.02] border border-edge/subtle"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center text-xs font-medium text-rayon-orange shrink-0">
                            {r.student.first_name.charAt(0)}
                            {r.student.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm text-white/90 font-medium">
                              {r.student.first_name} {r.student.last_name}
                            </p>
                            <p className="text-xs text-white/30 font-mono">{r.student.code}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {ATTENDANCE_STATUSES.map((s) => {
                            const Icon = s.icon;
                            const isActive = r.status === s.value;
                            const colorClasses: Record<string, string> = {
                              green: isActive
                                ? 'bg-green-500/15 text-green-400 border-green-500/30'
                                : 'text-white/40 border-edge hover:text-green-400 hover:border-green-500/20',
                              red: isActive
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'text-white/40 border-edge hover:text-red-400 hover:border-red-500/20',
                              yellow: isActive
                                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                                : 'text-white/40 border-edge hover:text-yellow-400 hover:border-yellow-500/20',
                              gray: isActive
                                ? 'bg-white/[0.08] text-white/60 border-white/[0.12]'
                                : 'text-white/40 border-edge hover:text-white/70',
                            };
                            return (
                              <button
                                key={s.value}
                                onClick={() => setStatus(r.student.id, s.value)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${colorClasses[s.color]}`}
                              >
                                <Icon size={12} />
                                {s.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Save bar */}
                    <div className="flex items-center justify-between pt-4 mt-2 border-t border-edge">
                      {savedMessage ? (
                        <span className="text-sm text-green-400 flex items-center gap-2">
                          <Check size={16} /> Frequência salva com sucesso!
                        </span>
                      ) : (
                        <span className="text-xs text-white/40">
                          {records.length} aluno(s) · {statusStats.pendente} pendente(s)
                        </span>
                      )}
                      <button
                        onClick={handleSave}
                        disabled={saving || statusStats.pendente === records.length}
                        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {saving ? <Spinner size={16} /> : <Save size={16} />}
                        {saving ? 'Salvando...' : 'Salvar Frequência'}
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* History */}
          {!selectedLessonId && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <History size={18} className="text-white/50" />
                <h3 className="text-sm font-semibold text-white/80">Aulas Recentes</h3>
              </div>
              {history.length === 0 ? (
                <EmptyState
                  icon={<ClipboardCheck size={28} />}
                  title="Nenhuma aula registrada"
                  description="Selecione uma aula acima para registrar a frequência"
                />
              ) : (
                <div className="space-y-2">
                  {history.map((lesson) => {
                    const att = lesson.attendance || [];
                    const present = att.filter((a) => a.status === 'presente').length;
                    const total = att.length;
                    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
                    return (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-edge/subtle cursor-pointer hover:bg-white/[0.04] transition-colors"
                        onClick={() => setSelectedLessonId(lesson.id)}
                      >
                        <div>
                          <p className="text-sm text-white/90 font-medium">{lesson.title}</p>
                          <p className="text-xs text-white/40 mt-0.5">
                            {lesson.class?.name || '—'} · {new Date(lesson.lesson_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {total > 0 ? (
                            <span className="text-xs text-white/50">
                              {present}/{total} ({rate}%)
                            </span>
                          ) : (
                            <span className="text-xs text-white/30">Sem registros</span>
                          )}
                          <StatusBadge status={lesson.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
