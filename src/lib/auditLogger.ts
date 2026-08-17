import { formatDateTime } from './dateUtils';

export interface DateAuditLog {
  id: string;
  timestamp: string; // Date et heure de la modification (horodatage système)
  user_id: string;
  user_name: string;
  user_role: string;
  module: 'Stock Véhicules' | 'Saisie Mouvement' | 'Historique Mouvements' | 'Facturation';
  entity_id: string;
  entity_label: string;
  field_name: string;
  old_value: string;
  new_value: string;
}

const STORAGE_KEY = 'parc_stafim_date_audit_logs';

export function getAuditLogs(): DateAuditLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading date audit logs:', err);
  }
  return [];
}

export function logDateChange(params: {
  currentUser: { id?: string; full_name?: string; role?: string };
  module: DateAuditLog['module'];
  entity_id: string;
  entity_label: string;
  field_name: string;
  old_value: string;
  new_value: string;
}): DateAuditLog | null {
  // Do not log if values are identical
  if (params.old_value === params.new_value) return null;

  const formattedTimestamp = formatDateTime(new Date());

  const newLog: DateAuditLog = {
    id: `log_date_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: formattedTimestamp,
    user_id: params.currentUser.id || 'usr_admin',
    user_name: params.currentUser.full_name || 'Ayari Intissar',
    user_role: params.currentUser.role || 'admin',
    module: params.module,
    entity_id: params.entity_id,
    entity_label: params.entity_label,
    field_name: params.field_name,
    old_value: params.old_value || '(vide)',
    new_value: params.new_value || '(vide)',
  };

  const currentLogs = getAuditLogs();
  const updatedLogs = [newLog, ...currentLogs];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedLogs));
  } catch (err) {
    console.error('Error saving date audit log:', err);
  }

  return newLog;
}

export function clearAuditLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing audit logs:', err);
  }
}
