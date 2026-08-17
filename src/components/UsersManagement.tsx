import React, { useState } from 'react';
import { Users, UserPlus, Shield, UserCheck, Eye, Lock, CheckCircle2, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { User, UserRole } from '../types';
import { api } from '../lib/api';

interface UsersManagementProps {
  users: User[];
  currentUser: User;
  onSelectCurrentUser: (user: User) => void;
  onRefresh: () => void;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({
  users,
  currentUser,
  onSelectCurrentUser,
  onRefresh,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [email, setEmail] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('agent');
  const [editEmail, setEditEmail] = useState('');

  // Delete User Confirmation State
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.createUser({
        full_name: fullName.trim(),
        role,
        email: email.trim().toLowerCase(),
      });
      setFullName('');
      setEmail('');
      setShowForm(false);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création de l utilisateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartEditUser = (user: User) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditRole(user.role);
    setEditEmail(user.email);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editFullName.trim() || !editEmail.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.updateUser(editingUser.id, {
        full_name: editFullName.trim(),
        role: editRole,
        email: editEmail.trim().toLowerCase(),
      });
      setEditingUser(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification de l utilisateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.deleteUser(deletingUser.id);
      setDeletingUser(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression de l utilisateur.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return (
          <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 border border-amber-300">
            Administrateur
          </span>
        );
      case 'agent':
        return (
          <span className="bg-blue-100 text-blue-900 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 border border-blue-300">
            Agent de Saisie
          </span>
        );
      case 'viewer':
        return (
          <span className="bg-emerald-100 text-emerald-900 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 border border-emerald-300">
            Consultant (Lecture seule)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 border-b-4 border-blue-600 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-black uppercase tracking-wider text-slate-100 flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Gestion des Utilisateurs & Habilitations</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestion des profils d accès (Administrateur, Agent de Saisie, Consultant).
          </p>
        </div>

        {currentUser.role === 'admin' && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 text-xs font-black uppercase tracking-wider transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Créer un Utilisateur</span>
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 text-xs text-rose-900 font-bold">
          {error}
        </div>
      )}

      {/* Add User Form */}
      {showForm && (
        <form onSubmit={handleCreateUser} className="bg-slate-50 p-5 border border-blue-300 space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Ajouter un profil utilisateur</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Nom Complet*</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="ex: Slim Ammar"
                className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Email Professionnel*</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: slim.ammar@parc-stafim.tn"
                className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">Rôle & Privilèges*</label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="w-full text-xs font-bold p-2.5 bg-white border border-slate-300 focus:outline-none focus:border-blue-600"
              >
                <option value="admin">Administrateur (Accès Total)</option>
                <option value="agent">Agent de Saisie (Création & Mouvements)</option>
                <option value="viewer">Consultant (Lecture Seule)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 uppercase font-bold tracking-wider"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-1.5 text-xs bg-blue-600 text-white font-black uppercase tracking-wider hover:bg-blue-500"
            >
              Créer l Utilisateur
            </button>
          </div>
        </form>
      )}

      {/* Role Explanations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-amber-50/80 border-l-4 border-amber-600 border-y border-r border-amber-200 space-y-1">
          <div className="flex items-center space-x-2 text-amber-950 font-black text-xs uppercase tracking-wider">
            <Shield className="w-4 h-4 text-amber-700" />
            <span>Administrateur</span>
          </div>
          <p className="text-[11px] text-amber-900 font-medium">
            Accès complet : Gestion des véhicules, déclaration des mouvements, création de sites, trajets et utilisateurs.
          </p>
        </div>

        <div className="p-4 bg-blue-50/80 border-l-4 border-blue-600 border-y border-r border-blue-200 space-y-1">
          <div className="flex items-center space-x-2 text-blue-950 font-black text-xs uppercase tracking-wider">
            <UserCheck className="w-4 h-4 text-blue-700" />
            <span>Agent de Saisie</span>
          </div>
          <p className="text-[11px] text-blue-900 font-medium">
            Opérationnel : Saisie des réceptions au port, enregistrement des transferts et sorties de stock.
          </p>
        </div>

        <div className="p-4 bg-emerald-50/80 border-l-4 border-emerald-600 border-y border-r border-emerald-200 space-y-1">
          <div className="flex items-center space-x-2 text-emerald-950 font-black text-xs uppercase tracking-wider">
            <Eye className="w-4 h-4 text-emerald-700" />
            <span>Consultant (Viewer)</span>
          </div>
          <p className="text-[11px] text-emerald-900 font-medium">
            Lecture seule : Recherche de véhicules par châssis, consultation des stocks par site et export CSV.
          </p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <span className="font-black text-xs uppercase tracking-wider">Profils Enregistrés ({users.length})</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest">Cliquez sur un profil pour l incarner activement</span>
        </div>
        <div className="divide-y divide-slate-100">
          {users.map((u) => {
            const isSelected = u.id === currentUser.id;
            return (
              <div
                key={u.id}
                onClick={() => onSelectCurrentUser(u)}
                className={`p-4 flex items-center justify-between cursor-pointer transition ${
                  isSelected ? 'bg-blue-50/90 border-l-4 border-blue-600' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 flex items-center justify-center font-black text-xs ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {u.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-slate-900 text-xs uppercase tracking-wider">{u.full_name}</span>
                      {isSelected && (
                        <span className="text-[9px] bg-blue-600 text-white font-black uppercase px-2 py-0.5 tracking-widest flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Profil Actif</span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">{u.email}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  {getRoleBadge(u.role)}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCurrentUser(u);
                    }}
                    className={`text-[10px] px-3 py-1 font-black uppercase tracking-wider transition ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                    }`}
                  >
                    {isSelected ? 'Actif' : 'Activer ce rôle'}
                  </button>

                  {currentUser.role === 'admin' && (
                    <div className="flex items-center space-x-1 border-l border-slate-200 pl-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEditUser(u);
                        }}
                        title="Modifier l utilisateur"
                        className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingUser(u);
                        }}
                        title="Supprimer l utilisateur"
                        className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-slate-100 transition rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-slate-900 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center space-x-2">
                <Pencil className="w-4 h-4 text-blue-600" />
                <span>Modifier l Utilisateur : {editingUser.full_name}</span>
              </h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Nom Complet*
                </label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Email Professionnel*
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Rôle & Privilèges*
                </label>
                <select
                  value={editRole}
                  onChange={(e: any) => setEditRole(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 bg-slate-50 border border-slate-300 focus:outline-none focus:border-blue-600"
                >
                  <option value="admin">Administrateur (Accès Total)</option>
                  <option value="agent">Agent de Saisie (Création & Mouvements)</option>
                  <option value="viewer">Consultant (Lecture Seule)</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DELETE USER CONFIRMATION */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border-2 border-rose-600 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">
                Confirmer la suppression
              </h3>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Voulez-vous vraiment supprimer l utilisateur <strong className="text-slate-900">{deletingUser.full_name}</strong> ({deletingUser.email}) ?
            </p>
            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-xs text-slate-700 font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                disabled={submitting}
                className="px-5 py-2 text-xs bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
