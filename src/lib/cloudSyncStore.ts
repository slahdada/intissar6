import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
  FirebaseUser,
} from './firebase';
import { localStore } from './localStore';
import { invoiceStore } from './invoiceStore';
import { batchBillingStore } from './batchBillingStore';
import { Vehicle, Site, Movement, Route, Carrier, TruckLoad, Invoice, BillingBatch } from '../types';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface CloudStats {
  vehiclesCount: number;
  movementsCount: number;
  invoicesCount: number;
  sitesCount: number;
  lastSyncTime: string | null;
}

type SyncListener = (status: SyncStatus, user: FirebaseUser | null, stats: CloudStats) => void;

let currentSyncStatus: SyncStatus = 'idle';
let currentFirebaseUser: FirebaseUser | null = null;
let lastSyncTimestamp: string | null = null;
let cloudStats: CloudStats = {
  vehiclesCount: 0,
  movementsCount: 0,
  invoicesCount: 0,
  sitesCount: 0,
  lastSyncTime: null,
};

const listeners: Set<SyncListener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => listener(currentSyncStatus, currentFirebaseUser, cloudStats));
}

export function subscribeCloudSync(listener: SyncListener) {
  listeners.add(listener);
  // Initial call
  listener(currentSyncStatus, currentFirebaseUser, cloudStats);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthErrorFrenchMessage(code: string): string {
  if (!code) return "Une erreur de connexion est survenue. Veuillez réessayer.";
  if (code.includes('api-key-not-valid') || code.includes('invalid-api-key')) {
    return "La clé API Firebase configurée n'est pas valide ou la console Firebase de votre projet n'a pas activé l'authentification. Vous pouvez basculer sur le serveur Firebase AI Studio valide ci-dessous.";
  }
  switch (code) {
    case 'auth/invalid-email':
      return "L'adresse e-mail renseignée est invalide.";
    case 'auth/user-not-found':
      return "Aucun compte associé à cette adresse e-mail.";
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return "E-mail ou mot de passe incorrect.";
    case 'auth/email-already-in-use':
      return "Un compte existe déjà avec cette adresse e-mail.";
    case 'auth/weak-password':
      return "Le mot de passe doit contenir au moins 6 caractères.";
    case 'auth/too-many-requests':
      return "Accès temporairement bloqué suite à trop de tentatives. Réessayez dans quelques minutes.";
    case 'auth/network-request-failed':
      return "Erreur réseau. Vérifiez votre connexion internet.";
    case 'auth/operation-not-allowed':
      return "L'authentification par e-mail/mot de passe n'est pas activée sur la console Firebase.";
    default:
      return `Erreur Firebase (${code}). Veuillez vérifier la configuration de votre projet.`;
  }
}

// --------------------------------------------------------------------------
// Cloud Data Load & Sync Logic
// --------------------------------------------------------------------------

export async function fetchUserCloudData(uid: string) {
  currentSyncStatus = 'syncing';
  notifyListeners();

  try {
    const collectionsToFetch = [
      'vehicles',
      'movements',
      'sites',
      'routes',
      'carriers',
      'truck_loads',
      'invoices',
      'billing_batches',
      'users',
    ];

    const results: Record<string, any[]> = {};

    for (const colName of collectionsToFetch) {
      const q = query(collection(db, colName), where('user_id', '==', uid));
      const snapshot = await getDocs(q);
      const items: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const { user_id, ...itemData } = data;
        items.push({ id: docSnap.id, ...itemData });
      });
      results[colName] = items;
    }

    // Check if cloud has user data
    const hasCloudData =
      results.vehicles.length > 0 ||
      results.movements.length > 0 ||
      results.invoices.length > 0 ||
      results.sites.length > 0;

    if (hasCloudData) {
      // Overwrite local caches with Cloud data
      if (results.vehicles.length > 0 || results.sites.length > 0 || results.users.length > 0) {
        localStore.overrideDatabaseFromCloud({
          vehicles: results.vehicles as Vehicle[],
          sites: results.sites as Site[],
          movements: results.movements as Movement[],
          routes: results.routes as Route[],
          carriers: results.carriers as Carrier[],
          truckLoads: results.truck_loads as TruckLoad[],
          users: results.users.length > 0 ? (results.users as any) : undefined,
        });
      }

      if (results.invoices.length > 0) {
        invoiceStore.overrideInvoicesFromCloud(results.invoices as Invoice[]);
      }

      if (results.billing_batches.length > 0) {
        batchBillingStore.overrideBatchesFromCloud(results.billing_batches as BillingBatch[]);
      }
    } else {
      // Cloud is empty for this user -> Automatically upload local data to Cloud
      await uploadAllLocalDataToCloud(uid);
    }

    lastSyncTimestamp = new Date().toISOString();
    cloudStats = {
      vehiclesCount: results.vehicles.length,
      movementsCount: results.movements.length,
      invoicesCount: results.invoices.length,
      sitesCount: results.sites.length,
      lastSyncTime: lastSyncTimestamp,
    };

    currentSyncStatus = 'synced';
    notifyListeners();
  } catch (err) {
    console.error('Error fetching cloud data:', err);
    currentSyncStatus = 'error';
    notifyListeners();
  }
}

export async function uploadAllLocalDataToCloud(uid: string) {
  currentSyncStatus = 'syncing';
  notifyListeners();

  try {
    const localDb = localStore.getFullDatabase();
    const localInvoices = invoiceStore.loadInvoices();
    const localBatches = batchBillingStore.loadBatches();

    const collectionsMap: Record<string, any[]> = {
      vehicles: localDb.vehicles,
      movements: localDb.movements,
      sites: localDb.sites,
      routes: localDb.routes,
      carriers: localDb.carriers,
      truck_loads: localDb.truckLoads,
      invoices: localInvoices,
      billing_batches: localBatches,
      users: localDb.users,
    };

    let batch = writeBatch(db);
    let operationCount = 0;

    for (const [colName, items] of Object.entries(collectionsMap)) {
      for (const item of items) {
        if (!item.id) continue;
        const docRef = doc(db, colName, item.id);
        batch.set(docRef, { ...item, user_id: uid }, { merge: true });
        operationCount++;

        // Firestore batch max limit is 500
        if (operationCount >= 450) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    // Update user profile doc
    const profileRef = doc(db, 'user_profiles', uid);
    await setDoc(
      profileRef,
      {
        email: auth.currentUser?.email,
        full_name: auth.currentUser?.displayName || 'Utilisateur',
        last_sync_at: new Date().toISOString(),
      },
      { merge: true }
    );

    lastSyncTimestamp = new Date().toISOString();
    cloudStats = {
      vehiclesCount: localDb.vehicles.length,
      movementsCount: localDb.movements.length,
      invoicesCount: localInvoices.length,
      sitesCount: localDb.sites.length,
      lastSyncTime: lastSyncTimestamp,
    };

    currentSyncStatus = 'synced';
    notifyListeners();
    return true;
  } catch (err) {
    console.error('Error uploading local data to cloud:', err);
    currentSyncStatus = 'error';
    notifyListeners();
    throw err;
  }
}

export async function saveDocToCloud(colName: string, id: string, data: any) {
  if (!currentFirebaseUser) return;
  currentSyncStatus = 'syncing';
  notifyListeners();

  try {
    const docRef = doc(db, colName, id);
    await setDoc(docRef, { ...data, user_id: currentFirebaseUser.uid }, { merge: true });
    currentSyncStatus = 'synced';
    lastSyncTimestamp = new Date().toISOString();
    notifyListeners();
  } catch (err) {
    console.error(`Error saving ${colName}/${id} to cloud:`, err);
    currentSyncStatus = 'error';
    notifyListeners();
  }
}

export async function deleteDocFromCloud(colName: string, id: string) {
  if (!currentFirebaseUser) return;
  currentSyncStatus = 'syncing';
  notifyListeners();

  try {
    const docRef = doc(db, colName, id);
    // Write empty or delete doc
    await setDoc(docRef, { _deleted: true, user_id: currentFirebaseUser.uid }, { merge: true });
    currentSyncStatus = 'synced';
    lastSyncTimestamp = new Date().toISOString();
    notifyListeners();
  } catch (err) {
    console.error(`Error deleting ${colName}/${id} from cloud:`, err);
    currentSyncStatus = 'error';
    notifyListeners();
  }
}

// Global Auth State Observer
export function initAuthSync(onUserChange: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    currentFirebaseUser = user;
    onUserChange(user);
    if (user) {
      fetchUserCloudData(user.uid).catch((err) => {
        console.error('Error fetching cloud data:', err);
      });
    } else {
      currentSyncStatus = 'idle';
      notifyListeners();
    }
  });
}
