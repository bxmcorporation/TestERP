import { supabase } from './supabase';

export async function logActivity(type: string, title: string, description?: string, entityType?: string, entityId?: string) {
  try {
    await supabase.from('activities').insert({
      type,
      title,
      description,
      entity_type: entityType,
      entity_id: entityId,
    });
  } catch {
    // Silent fail — logging is non-critical
  }
}

export async function generateCode(prefix: string, table: string): Promise<string> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }

  const next = (count || 0) + 1;
  return `${prefix}-${String(next).padStart(5, '0')}`;
}
