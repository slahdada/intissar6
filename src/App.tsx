import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { VehiclesList } from './components/VehiclesList';
import { VehicleDetailModal } from './components/VehicleDetailModal';
import { MovementForm } from './components/MovementForm';
import { MovementsHistory } from './components/MovementsHistory';
import { SitesAndRoutes } from './components/SitesAndRoutes';
import { UsersManagement } from './components/UsersManagement';
import { BillingModule } from './components/BillingModule';
import { SynthesisModule } from './components/SynthesisModule';
import { SettledVehiclesModule } from './components/SettledVehiclesModule';
import { AiAssistantModal } from './components/AiAssistantModal';
import { CsvAuditModal } from './components/CsvAuditModal';
import { DateAuditLogModal } from './components/DateAuditLogModal';
import { AuthScreen } from './components/AuthScreen';
import { AccountModal } from './components/AccountModal';
import { FirebaseUser, auth, signOut } from './lib/firebase';
import { initAuthSync, subscribeCloudSync, SyncStatus } from './lib/cloudSyncStore';
import { api } from './lib/api';
import { invoiceStore } from './lib/invoiceStore';
import {
  Vehicle,
  Site,
  Route as RouteType,
  User,
  Carrier,
  StockStats,
  MovementWithDetails,
  Invoice,
} from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // Auth & Cloud Sync state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [demoUser, setDemoUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [showAccountModal, setShowAccountModal] = useState(false);

  const activeUser = firebaseUser || demoUser;

  // Master State
  const [stats, setStats] = useState<StockStats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // User Role Switcher
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr_admin',
    full_name: 'Ayari Intissar',
    role: 'admin',
    email: 'intissar.ayari@parc-stafim.tn',
    active: true,
  });

  // Modals & Selections
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  const [movementPreselectedVehicle, setMovementPreselectedVehicle] = useState<Vehicle | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCsvAuditModal, setShowCsvAuditModal] = useState(false);
  const [showDateAuditModal, setShowDateAuditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Listen to Firebase Auth & Sync
  useEffect(() => {
    // Safety fallback: ensure authChecking becomes false within 1.5 seconds maximum
    const timer = setTimeout(() => {
      setAuthChecking(false);
    }, 1500);

    const unsubAuth = initAuthSync((user) => {
      clearTimeout(timer);
      setFirebaseUser(user);
      setAuthChecking(false);
      if (user) {
        // Adapt currentUser email to logged in user
        setCurrentUser((prev) => ({
          ...prev,
          email: user.email || prev.email,
          full_name: user.displayName || prev.full_name,
        }));
      }
    });

    const unsubSync = subscribeCloudSync((status) => {
      setSyncStatus(status);
    });

    return () => {
      clearTimeout(timer);
      unsubAuth();
      unsubSync();
    };
  }, []);

  // Load all master data
  const loadData = useCallback(async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const [statsData, vehiclesData, sitesData, routesData, movementsData, usersData, carriersData] =
        await Promise.all([
          api.getStats(),
          api.getVehicles(),
          api.getSites(),
          api.getRoutes(),
          api.getMovements(),
          api.getUsers(),
          api.getCarriers(),
        ]);

      setStats(statsData);
      setVehicles(vehiclesData);
      setSites(sitesData);
      setRoutes(routesData);
      setMovements(movementsData);
      setUsers(usersData);
      setCarriers(carriersData);
      setInvoices(invoiceStore.loadInvoices());

      // Keep current user updated if users list reloads
      if (usersData.length > 0) {
        const found = usersData.find((u) => u.id === currentUser.id);
        if (found) setCurrentUser(found);
      }
    } catch (err) {
      console.error('Failed to load application data from server, falling back to local storage', err);
      try {
        const statsData = await api.getStats();
        const vehiclesData = await api.getVehicles();
        const sitesData = await api.getSites();
        const routesData = await api.getRoutes();
        const movementsData = await api.getMovements();
        const usersData = await api.getUsers();

        setStats(statsData);
        setVehicles(vehiclesData);
        setSites(sitesData);
        setRoutes(routesData);
        setMovements(movementsData);
        setUsers(usersData);
      } catch (fallbackErr) {
        console.error('Critical data load failure', fallbackErr);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    if (activeUser) {
      loadData();
    }
  }, [activeUser, syncStatus, loadData]);

  const handleDemoLogin = () => {
    const fakeUser = {
      uid: 'demo-local-user',
      email: 'demo@parc-stafim.tn',
      displayName: 'Utilisateur Démo',
    } as FirebaseUser;
    setDemoUser(fakeUser);
    setCurrentUser((prev) => ({
      ...prev,
      email: 'demo@parc-stafim.tn',
      full_name: 'Utilisateur Démo',
    }));
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Initialisation de la connexion sécurisée Cloud...
          </p>
        </div>
      </div>
    );
  }

  if (!activeUser) {
    return <AuthScreen onDemoLogin={handleDemoLogin} />;
  }

  const handleLogout = async () => {
    try {
      if (demoUser) {
        setDemoUser(null);
      } else {
        await signOut(auth);
      }
    } catch (err) {
      console.error('Error logging out:', err);
      setDemoUser(null);
    }
  };

  const handleQuickSearch = async (chassisQuery?: string | null) => {
    if (!chassisQuery || typeof chassisQuery !== 'string') return;
    const trimmed = chassisQuery.trim();
    if (!trimmed) return;

    const qLower = trimmed.toLowerCase();

    // Check in-memory vehicles list first
    const matchedInMemory = vehicles.find(
      (v) =>
        (v.chassis_number && v.chassis_number.toLowerCase() === qLower) ||
        (v.vin && v.vin.toLowerCase() === qLower) ||
        (v.chassis_number && v.chassis_number.toLowerCase().includes(qLower)) ||
        (v.vin && v.vin.toLowerCase().includes(qLower)) ||
        (v.stock_number && v.stock_number.toLowerCase().includes(qLower))
    );

    if (matchedInMemory) {
      setSelectedVehicleId(matchedInMemory.id);
      setVehicleSearchTerm(trimmed);
      setActiveTab('vehicles');
      return;
    }

    try {
      const v = await api.getVehicleByChassis(trimmed);
      if (v) {
        setSelectedVehicleId(v.id);
        setVehicleSearchTerm(trimmed);
        setActiveTab('vehicles');
        return;
      }
    } catch {
      // If not exact match, fall through to search in vehicles list
    }

    setVehicleSearchTerm(trimmed);
    setActiveTab('vehicles');
  };

  const handleDeclareMovementForVehicle = (v: Vehicle) => {
    setMovementPreselectedVehicle(v);
    setActiveTab('movement_form');
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans flex flex-col antialiased">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab !== 'movement_form') setMovementPreselectedVehicle(null);
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        setCurrentUser={setCurrentUser}
        users={users}
        onQuickSearch={handleQuickSearch}
        onOpenAiModal={() => setShowAiModal(true)}
        onOpenDateAuditModal={() => setShowDateAuditModal(true)}
        onRefreshData={() => loadData(true)}
        isRefreshing={isRefreshing}
        firebaseUser={activeUser}
        syncStatus={syncStatus}
        onOpenAccountModal={() => setShowAccountModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            stats={stats}
            loading={loading}
            onNavigate={(tab) => {
              if (tab !== 'movement_form') setMovementPreselectedVehicle(null);
              setActiveTab(tab);
            }}
            onSelectVehicle={(chassis) => handleQuickSearch(chassis)}
            userRole={currentUser.role}
            movements={movements}
            vehicles={vehicles}
            sites={sites}
          />
        )}

        {activeTab === 'synthese' && (
          <SynthesisModule
            vehicles={vehicles}
            sites={sites}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
          />
        )}

        {activeTab === 'vehicles' && (
          <VehiclesList
            vehicles={vehicles}
            sites={sites}
            invoices={invoices}
            movements={movements}
            loading={loading}
            initialSearchTerm={vehicleSearchTerm}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
            onOpenAddModal={() => {
              setMovementPreselectedVehicle(null);
              setActiveTab('movement_form');
            }}
            userRole={currentUser.role}
            onRefresh={() => loadData(false)}
            onNavigateToSolded={() => setActiveTab('solded_vehicles')}
          />
        )}

        {activeTab === 'solded_vehicles' && (
          <SettledVehiclesModule
            vehicles={vehicles}
            sites={sites}
            movements={movements}
            invoices={invoices}
            userRole={currentUser.role}
            onRefresh={() => loadData(false)}
            onSelectVehicle={(v) => setSelectedVehicleId(v.id)}
            onNavigateToStock={() => setActiveTab('vehicles')}
          />
        )}

        {activeTab === 'movement_form' && (
          <MovementForm
            vehicles={vehicles}
            sites={sites}
            routes={routes}
            currentUser={currentUser}
            preselectedVehicle={movementPreselectedVehicle}
            onSuccess={() => loadData(false)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'movements_history' && (
          <MovementsHistory
            movements={movements}
            sites={sites}
            vehicles={vehicles}
            loading={loading}
            onSelectVehicle={(chassis) => handleQuickSearch(chassis)}
            onRefresh={() => loadData(false)}
            userRole={currentUser.role}
            currentUser={currentUser}
          />
        )}

        {activeTab === 'billing' && (
          <BillingModule
            movements={movements}
            sites={sites}
            vehicles={vehicles}
            userRole={currentUser.role}
            currentUser={currentUser}
            onNavigateToMovements={() => setActiveTab('movements_history')}
            onRefresh={() => loadData(false)}
          />
        )}

        {activeTab === 'sites_routes' && (
          <SitesAndRoutes
            sites={sites}
            routes={routes}
            userRole={currentUser.role}
            onRefresh={() => loadData(false)}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'users' && (
          <UsersManagement
            users={users}
            currentUser={currentUser}
            onSelectCurrentUser={(u) => setCurrentUser(u)}
            onRefresh={() => loadData(false)}
          />
        )}
      </main>

      {/* Vehicle Detail Modal */}
      {selectedVehicleId && (
        <VehicleDetailModal
          vehicleId={selectedVehicleId}
          onClose={() => setSelectedVehicleId(null)}
          onDeclareMovementForVehicle={handleDeclareMovementForVehicle}
          sites={sites}
          userRole={currentUser.role}
          currentUser={currentUser}
          onVehicleUpdated={() => loadData(false)}
        />
      )}

      {/* Gemini AI Assistant Modal */}
      {showAiModal && (
        <AiAssistantModal
          onClose={() => setShowAiModal(false)}
          onOpenCsvAudit={() => {
            setShowAiModal(false);
            setShowCsvAuditModal(true);
          }}
          onSelectChassis={(chassis) => {
            setShowAiModal(false);
            handleQuickSearch(chassis);
          }}
        />
      )}

      {/* CSV Audit & Reconciliation Modal */}
      {showCsvAuditModal && (
        <CsvAuditModal onClose={() => setShowCsvAuditModal(false)} />
      )}

      {/* Date Change Audit Log Modal */}
      {showDateAuditModal && (
        <DateAuditLogModal onClose={() => setShowDateAuditModal(false)} />
      )}

      {/* Account & Cloud Sync Modal */}
      {showAccountModal && activeUser && (
        <AccountModal
          user={activeUser}
          onClose={() => setShowAccountModal(false)}
          onDataImported={() => loadData(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs space-y-1">
          <p className="font-semibold text-slate-300">
            Gestion Parc Véhicules — Transport Terrestre & Logistique Automobile
          </p>
          <p className="text-slate-500">
            Port de La Goulette • Parc STAFIM Megrine • Entrepôt Mghira • Entrepôt Charguia • Parc Sfax
          </p>
        </div>
      </footer>
    </div>
  );
}
