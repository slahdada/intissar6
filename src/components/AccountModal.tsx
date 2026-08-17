import React, { useState, useEffect } from 'react';
import { FirebaseUser, auth, signOut } from '../lib/firebase';
import {
  SyncStatus,
  CloudStats,
  subscribeCloudSync,
  uploadAllLocalDataToCloud,
  fetchUserCloudData,
} from '../lib/cloudSyncStore';
import {
  User,
  Mail,
  ShieldCheck,
  Cloud,
  CloudUpload,
  RefreshCw,
  LogOut,
  X,
  CheckCircle2,
  AlertCircle,
  Database,
  Car,
  Receipt,
  ArrowLeftRight,
  Building2,
} from 'lucide-react';

interface AccountModalProps {
  user: FirebaseUser;
  onClose: () => void;
  onDataImported?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ user, onClose, onDataImported }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [stats, setStats] = useState<CloudStats>({
    vehiclesCount: 0,
    movementsCount: 0,
    invoicesCount: 0,
    sitesCount: 0,
    lastSyncTime: null,
  });

  const [isUploading, setIsUploading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeCloudSync((status, _, currentStats) => {
      setSyncStatus(status);
      setStats(currentStats);
    });
    return () => unsubscribe();
  }, []);

  const handleImportLocalToCloud = async () => {
    setIsUploading(true);
    setFeedback(null);
    try {
      await uploadAllLocalDataToCloud(user.uid);
      setFeedback({
        type: 'success',
        message: 'Importation réussie ! Vos données locales sont désormais sauvegardées dans votre compte cloud.',
      });
      if (onDataImported) onDataImported();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Échec de l\'importation des données vers le cloud. Vérifiez votre connexion internet.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshFromCloud = async () => {
    setIsRefreshing(true);
    setFeedback(null);
    try {
      await fetchUserCloudData(user.uid);
      setFeedback({
        type: 'success',
        message: 'Données rechargées avec succès depuis votre compte cloud.',
      });
      if (onDataImported) onDataImported();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Échec du chargement des données cloud.',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onClose();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
      <div className="bg-slate-900 border border-slate-800 text-white w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Modal Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/10 border border-blue-500/30">
              <Cloud className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">
                Mon Compte & Synchronisation Cloud
              </h2>
              <p className="text-[11px] text-slate-400 font-medium">Sauvegarde permanente et sécurité des données</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Feedback banner */}
          {feedback && (
            <div
              className={`p-3.5 border text-xs font-semibold flex items-center space-x-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                  : 'bg-red-950/80 border-red-800 text-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* User Profile Card */}
          <div className="p-4 bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-blue-400 font-black text-sm uppercase border border-slate-700">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-100">
                    {user.displayName || 'Utilisateur Connecté'}
                  </h3>
                  <div className="flex items-center space-x-1.5 text-[11px] text-slate-400 font-mono">
                    <Mail className="w-3 h-3 text-slate-500" />
                    <span>{user.email}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center space-x-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800">
                  <ShieldCheck className="w-3 h-3 text-blue-400" />
                  <span>Cloud Actif</span>
                </span>
              </div>
            </div>
          </div>

          {/* Sync Status Badge */}
          <div className="p-4 bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                État de synchronisation :
              </span>
              {syncStatus === 'synced' && (
                <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sauvegardé</span>
                </span>
              )}
              {syncStatus === 'syncing' && (
                <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-amber-400 bg-amber-950/80 px-2.5 py-1 border border-amber-800">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synchronisation en cours...</span>
                </span>
              )}
              {syncStatus === 'error' && (
                <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-red-400 bg-red-950/80 px-2.5 py-1 border border-red-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Erreur de sauvegarde</span>
                </span>
              )}
            </div>

            {stats.lastSyncTime && (
              <p className="text-[10px] text-slate-500 font-mono">
                Dernière synchronisation : {new Date(stats.lastSyncTime).toLocaleString('fr-FR')}
              </p>
            )}
          </div>

          {/* Cloud Stats Grid */}
          <div>
            <span className="block text-[11px] font-black uppercase tracking-wider text-slate-400 mb-2">
              Données stockées dans votre compte :
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 bg-slate-950 border border-slate-800 flex items-center space-x-3">
                <Car className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="block text-sm font-black text-white">{stats.vehiclesCount}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Véhicules</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 flex items-center space-x-3">
                <ArrowLeftRight className="w-5 h-5 text-indigo-400 shrink-0" />
                <div>
                  <span className="block text-sm font-black text-white">{stats.movementsCount}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Mouvements</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 flex items-center space-x-3">
                <Receipt className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="block text-sm font-black text-white">{stats.invoicesCount}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Factures</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 flex items-center space-x-3">
                <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="block text-sm font-black text-white">{stats.sitesCount}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Sites</span>
                </div>
              </div>
            </div>
          </div>

          {/* Migration / Sync Actions */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleImportLocalToCloud}
              disabled={isUploading || isRefreshing}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-black uppercase tracking-wider py-2.5 px-4 flex items-center justify-center space-x-2 transition"
            >
              <CloudUpload className="w-4 h-4 text-amber-300" />
              <span>
                {isUploading
                  ? 'Importation en cours...'
                  : 'Importer mes données locales dans mon compte cloud'}
              </span>
            </button>

            <button
              onClick={handleRefreshFromCloud}
              disabled={isUploading || isRefreshing}
              className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-200 text-xs font-bold uppercase tracking-wider py-2.5 px-4 flex items-center justify-center space-x-2 border border-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Forcer la re-synchronisation depuis le cloud</span>
            </button>
          </div>

          {/* Security Notice */}
          <div className="p-3 bg-slate-950 border border-slate-800/80 text-[10px] text-slate-400 space-y-1">
            <span className="font-bold text-slate-300 uppercase block">Sécurité & Confidentialité (RLS) :</span>
            <p>
              Toutes vos données sont isolées par clé d'authentification unique. Seul votre compte a la permission de consulter et modifier vos enregistrements.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 bg-red-950/80 hover:bg-red-900 text-red-200 text-xs font-bold uppercase tracking-wider py-2 px-3 border border-red-800 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Se déconnecter</span>
          </button>

          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider py-2 px-4 border border-slate-700 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
