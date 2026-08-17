import { User, UserRole } from '../types';

/**
 * Checks if the current user is authorized to edit business dates.
 * Requirement:
 * "Ajoute l’édition des dates dans Stock Véhicules, Saisie Mouvement, Historique Mouvements
 *  (champ métier séparé seulement, jamais l’horodatage système) et Facturation,
 *  mais uniquement pour 'Ayari Intissar (Administrateur)'.
 *  Tous les autres rôles doivent voir les dates en lecture seule sans bouton Modifier."
 */
export function canEditBusinessDate(user?: { role?: string; full_name?: string } | null): boolean {
  if (!user) return false;
  const isAyariIntissar = (user.full_name || '').toLowerCase().includes('ayari intissar');
  const isAdmin = user.role === 'admin';
  return isAdmin && isAyariIntissar;
}
