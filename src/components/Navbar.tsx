import React, { useState } from 'react';
import {
  LayoutDashboard,
  Car,
  ArrowLeftRight,
  History,
  MapPin,
  Users,
  Search,
  Sparkles,
  ShieldAlert,
  Menu,
  X,
  RefreshCw,
  Receipt,
  FileClock,
  FileCheck,
  Cloud,
  CheckCircle2,
  LogOut,
  UserCheck,
  AlertCircle,
} from 'lucide-react';
import { UserRole, User } from '../types';
import { FirebaseUser } from '../lib/firebase';
import { SyncStatus } from '../lib/cloudSyncStore';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User;
  setCurrentUser: (user: User) => void;
  users: User[];
  onQuickSearch: (chassis: string) => void;
  onOpenAiModal: () => void;
  onOpenDateAuditModal?: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  firebaseUser?: FirebaseUser | null;
  syncStatus?: SyncStatus;
  onOpenAccountModal?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  setCurrentUser,
  users,
  onQuickSearch,
  onOpenAiModal,
  onOpenDateAuditModal,
  onRefreshData,
  isRefreshing,
  firebaseUser,
  syncStatus = 'synced',
  onOpenAccountModal,
  onLogout,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onQuickSearch(searchInput.trim());
      setSearchInput('');
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'synthese', label: 'Synthèse Flux', icon: FileClock },
    { id: 'vehicles', label: 'Stock Véhicules', icon: Car },
    { id: 'solded_vehicles', label: 'Véhicules Soldés', icon: FileCheck },
    { id: 'movement_form', label: 'Saisie Mouvement', icon: ArrowLeftRight },
    { id: 'movements_history', label: 'Historique Mouvements', icon: History },
    { id: 'billing', label: 'Facturation', icon: Receipt },
    { id: 'sites_routes', label: 'Sites & Trajets', icon: MapPin },
    { id: 'users', label: 'Utilisateurs', icon: Users },
  ];

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'agent':
        return 'Agent de Saisie';
      case 'viewer':
        return 'Consultant (Lecture seule)';
      default:
        return role;
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'agent':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'viewer':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3.5 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
            <div className="w-10 h-10 bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 border-2 border-blue-500 rotate-45 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white"></div>
              </div>
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider uppercase text-slate-100 leading-none">
                Gestion Parc <span className="text-blue-500">Véhicules</span>
              </h1>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mt-1">
                Logistique & Stock Neuf
              </span>
            </div>
          </div>

          {/* Search Box Desktop */}
          <div className="hidden md:flex items-center flex-1 min-w-[240px] max-w-md mx-4">
            <form onSubmit={handleSearchSubmit} className="w-full flex items-center bg-slate-950 border border-slate-700 focus-within:border-blue-500 transition-colors">
              <span className="px-2.5 text-slate-400 font-black uppercase text-[10px] tracking-wider border-r border-slate-800 shrink-0 select-none">
                VIN:
              </span>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Recherche châssis (17 car.)..."
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-xs px-2.5 py-1.5 focus:outline-none font-mono tracking-wider min-w-[100px]"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 font-black uppercase tracking-wider shrink-0 transition"
              >
                Chercher
              </button>
            </form>
          </div>

          {/* Right Controls: Sync badge, AI assistant, Audit Log, Account Modal, Logout */}
          <div className="hidden md:flex items-center space-x-2.5">
            {/* Sync Badge */}
            <button
              onClick={onOpenAccountModal}
              title="Mon compte et statut de synchronisation"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 transition"
            >
              {syncStatus === 'synced' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Sauvegardé</span>
                </>
              )}
              {syncStatus === 'syncing' && (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Synchro...</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Erreur synchro</span>
                </>
              )}
            </button>

            {onOpenDateAuditModal && (
              <button
                onClick={onOpenDateAuditModal}
                title="Journal d audit de modification des dates"
                className="flex items-center space-x-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] px-2.5 py-2 font-black uppercase tracking-widest shadow-sm transition active:scale-95 border border-amber-600/30"
              >
                <FileClock className="w-3.5 h-3.5 text-slate-950" />
                <span>Journal Dates</span>
              </button>
            )}

            <button
              onClick={onOpenAiModal}
              title="Assistant IA - Analyse de manifeste & châssis"
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-3 py-2 font-black uppercase tracking-widest shadow-sm transition active:scale-95 border border-indigo-400/30"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Assistant IA</span>
            </button>

            {/* Account Info Button */}
            {firebaseUser && (
              <button
                onClick={onOpenAccountModal}
                title="Mon compte et synchronisation"
                className="flex items-center space-x-2 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-bold px-3 py-1.5 border border-slate-700 transition"
              >
                <Cloud className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-[11px] font-mono truncate max-w-[140px]">
                  {firebaseUser.displayName || firebaseUser.email}
                </span>
              </button>
            )}

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                title="Se déconnecter"
                className="p-2 bg-red-950/80 hover:bg-red-900 text-red-200 transition border border-red-800 shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mobile menu trigger */}
          <div className="md:hidden flex items-center space-x-2">
            <button
              onClick={onOpenAiModal}
              className="p-2 bg-indigo-600 text-white text-xs font-bold uppercase"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-400 hover:text-white focus:outline-none"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs Desktop */}
      <div className="bg-slate-950 border-t border-slate-800/80 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-0.5 py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-slate-800 px-4 pt-3 pb-4 space-y-3">
          <form onSubmit={handleSearchSubmit} className="w-full flex items-center bg-slate-900 border border-slate-700 focus-within:border-blue-500">
            <span className="px-2.5 text-slate-400 font-black uppercase text-[10px] tracking-wider border-r border-slate-800 shrink-0 select-none">
              VIN:
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Recherche châssis..."
              className="w-full bg-transparent text-white placeholder-slate-500 text-xs px-2.5 py-2 focus:outline-none font-mono"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-2 font-black uppercase tracking-wider shrink-0 transition"
            >
              Chercher
            </button>
          </form>

          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest ${
                    isActive ? 'bg-slate-800 text-white border-l-2 border-blue-500' : 'text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800 flex flex-col space-y-2">
            {firebaseUser && (
              <div className="p-2.5 bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cloud className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-mono font-bold text-slate-200 truncate max-w-[180px]">
                    {firebaseUser.email}
                  </span>
                </div>
                {syncStatus === 'synced' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {syncStatus === 'syncing' && <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />}
                {syncStatus === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>
            )}

            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                if (onOpenAccountModal) onOpenAccountModal();
              }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider p-2.5 flex items-center justify-center space-x-2"
            >
              <Cloud className="w-4 h-4 text-amber-300" />
              <span>Mon Compte & Synchro</span>
            </button>

            {onLogout && (
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full bg-red-950 hover:bg-red-900 text-red-200 text-xs font-bold uppercase tracking-wider p-2.5 border border-red-800 flex items-center justify-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
