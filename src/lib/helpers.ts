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
  const { data, error } = await supabase.rpc('generate_code', {
    p_prefix: prefix,
    p_table: table,
  });

  if (error || !data) {
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  }

  return data as string;
}
