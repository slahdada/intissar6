import {
  Vehicle,
  Site,
  Movement,
  Route,
  User,
  Carrier,
  TruckLoad,
  TruckLoadVehicle,
  TruckLoadHistoryItem,
  CreateVehiclePayload,
  CreateMovementPayload,
  StockStats,
  MovementWithDetails,
  MovementType,
} from '../types';
import { localStore } from './localStore';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('application/json')) {
    throw new Error('Server API unavailable');
  }

  const data = await res.json();
  return data as T;
}

export const api = {
  getStats: async (): Promise<StockStats> => {
    try {
      return await fetchJSON<StockStats>('/api/stats');
    } catch {
      return localStore.getStats();
    }
  },

  getVehicles: async (params?: {
    search?: string;
    site?: string;
    brand?: string;
    model?: string;
    status?: string;
  }): Promise<Vehicle[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.set('search', params.search);
      if (params?.site) query.set('site', params.site);
      if (params?.brand) query.set('brand', params.brand);
      if (params?.model) query.set('model', params.model);
      if (params?.status) query.set('status', params.status);
      return await fetchJSON<Vehicle[]>(`/api/vehicles?${query.toString()}`);
    } catch {
      return localStore.getVehicles(params);
    }
  },

  getVehicleById: async (id: string) => {
    try {
      return await fetchJSON<Vehicle & { current_site_name: string; movements: Movement[] }>(`/api/vehicles/${id}`);
    } catch {
      return localStore.getVehicleById(id);
    }
  },

  getVehicleByChassis: async (chassis: string): Promise<Vehicle> => {
    try {
      return await fetchJSON<Vehicle>(`/api/vehicles/chassis/${encodeURIComponent(chassis)}`);
    } catch {
      return localStore.getVehicleByChassis(chassis);
    }
  },

  createVehicle: async (payload: CreateVehiclePayload) => {
    try {
      return await fetchJSON<{ vehicle: Vehicle; movement: Movement }>('/api/vehicles', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createVehicle(payload);
    }
  },

  bulkCreateVehicles: async (payloads: CreateVehiclePayload[]) => {
    try {
      return await fetchJSON<{
        createdCount: number;
        errorCount: number;
        created: Vehicle[];
        errors: { index: number; chassis_number?: string; error: string }[];
      }>('/api/vehicles/bulk', {
        method: 'POST',
        body: JSON.stringify(payloads),
      });
    } catch {
      return localStore.bulkCreateVehicles(payloads);
    }
  },

  updateVehicle: async (
    id: string,
    payload: Partial<Vehicle> & Record<string, any>
  ) => {
    try {
      return await fetchJSON<Vehicle>(`/api/vehicles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateVehicle(id, payload);
    }
  },

  getMovements: async (params?: {
    vehicle_id?: string;
    site_id?: string;
    movement_type?: string;
    startDate?: string;
    endDate?: string;
    chassis?: string;
  }): Promise<MovementWithDetails[]> => {
    try {
      const query = new URLSearchParams();
      if (params?.vehicle_id) query.set('vehicle_id', params.vehicle_id);
      if (params?.site_id) query.set('site_id', params.site_id);
      if (params?.movement_type) query.set('movement_type', params.movement_type);
      if (params?.startDate) query.set('startDate', params.startDate);
      if (params?.endDate) query.set('endDate', params.endDate);
      if (params?.chassis) query.set('chassis', params.chassis);
      return await fetchJSON<MovementWithDetails[]>(`/api/movements?${query.toString()}`);
    } catch {
      return localStore.getMovements(params);
    }
  },

  createMovement: async (payload: CreateMovementPayload) => {
    try {
      return await fetchJSON<{ vehicle: Vehicle; movement: Movement }>('/api/movements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createMovement(payload);
    }
  },

  getSites: async (): Promise<Site[]> => {
    try {
      return await fetchJSON<Site[]>('/api/sites');
    } catch {
      return localStore.getSites();
    }
  },

  createSite: async (payload: { name: string; type: string; address?: string }) => {
    try {
      return await fetchJSON<Site>('/api/sites', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createSite(payload);
    }
  },

  updateSite: async (id: string, payload: { name?: string; type?: string; address?: string }) => {
    try {
      return await fetchJSON<Site>(`/api/sites/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateSite(id, payload);
    }
  },

  deleteSite: async (id: string) => {
    try {
      return await fetchJSON<{ message: string }>(`/api/sites/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteSite(id);
    }
  },

  getRoutes: async (): Promise<Route[]> => {
    try {
      return await fetchJSON<Route[]>('/api/routes');
    } catch {
      return localStore.getRoutes();
    }
  },

  createRoute: async (payload: { departure_site_id: string; arrival_site_id: string; waypoints?: string[]; route_name?: string }) => {
    try {
      return await fetchJSON<Route>('/api/routes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createRoute(payload);
    }
  },

  updateRoute: async (id: string, payload: { departure_site_id?: string; arrival_site_id?: string; waypoints?: string[]; route_name?: string }) => {
    try {
      return await fetchJSON<Route>(`/api/routes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateRoute(id, payload);
    }
  },

  deleteRoute: async (id: string) => {
    try {
      return await fetchJSON<{ message: string }>(`/api/routes/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteRoute(id);
    }
  },

  deleteVehicle: async (id: string) => {
    try {
      return await fetchJSON<{ message: string }>(`/api/vehicles/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteVehicle(id);
    }
  },

  purgeAllVehicles: async () => {
    try {
      return await fetchJSON<{ message: string; count: number }>('/api/vehicles/purge', {
        method: 'DELETE',
      });
    } catch {
      return localStore.purgeAllVehicles();
    }
  },

  renameBrandInVehicles: async (oldBrand: string, newBrand: string) => {
    try {
      return await fetchJSON<{ updatedCount: number }>('/api/vehicles/rename-brand', {
        method: 'POST',
        body: JSON.stringify({ oldBrand, newBrand }),
      });
    } catch {
      return { updatedCount: localStore.renameBrandInVehicles(oldBrand, newBrand) };
    }
  },

  renameModelInVehicles: async (brand: string, oldModel: string, newModel: string) => {
    try {
      return await fetchJSON<{ updatedCount: number }>('/api/vehicles/rename-model', {
        method: 'POST',
        body: JSON.stringify({ brand, oldModel, newModel }),
      });
    } catch {
      return { updatedCount: localStore.renameModelInVehicles(brand, oldModel, newModel) };
    }
  },

  deleteBrandInVehicles: async (brand: string) => {
    try {
      return await fetchJSON<{ updatedCount: number }>('/api/vehicles/delete-brand', {
        method: 'POST',
        body: JSON.stringify({ brand }),
      });
    } catch {
      return { updatedCount: localStore.deleteBrandInVehicles(brand) };
    }
  },

  deleteModelInVehicles: async (brand: string, model: string) => {
    try {
      return await fetchJSON<{ updatedCount: number }>('/api/vehicles/delete-model', {
        method: 'POST',
        body: JSON.stringify({ brand, model }),
      });
    } catch {
      return { updatedCount: localStore.deleteModelInVehicles(brand, model) };
    }
  },

  updateMovement: async (
    id: string,
    payload: {
      movement_type?: MovementType;
      departure_site_id?: string | null;
      arrival_site_id?: string | null;
      destination_text?: string;
      movement_date?: string;
      notes?: string;
      waypoints?: string[];
    }
  ) => {
    try {
      return await fetchJSON<Movement>(`/api/movements/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateMovement(id, payload);
    }
  },

  deleteMovement: async (id: string) => {
    try {
      return await fetchJSON<{ message: string }>(`/api/movements/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteMovement(id);
    }
  },

  getUsers: async (): Promise<User[]> => {
    try {
      return await fetchJSON<User[]>('/api/users');
    } catch {
      return localStore.getUsers();
    }
  },

  createUser: async (payload: { full_name: string; role: string; email: string }) => {
    try {
      return await fetchJSON<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createUser(payload);
    }
  },

  updateUser: async (id: string, payload: { full_name?: string; role?: string; email?: string }) => {
    try {
      return await fetchJSON<User>(`/api/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateUser(id, payload);
    }
  },

  deleteUser: async (id: string) => {
    try {
      return await fetchJSON<{ message: string }>(`/api/users/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteUser(id);
    }
  },

  resetData: async () => {
    try {
      return await fetchJSON<{ message: string }>('/api/reset-data', {
        method: 'POST',
      });
    } catch {
      return localStore.resetData();
    }
  },

  aiAssistant: async (prompt: string) => {
    try {
      return await fetchJSON<{ text: string }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });
    } catch {
      return localStore.aiAssistant(prompt);
    }
  },

  getCarriers: async (): Promise<Carrier[]> => {
    try {
      return await fetchJSON<Carrier[]>('/api/carriers');
    } catch {
      return localStore.getCarriers();
    }
  },

  createCarrier: async (payload: { raisonSociale: string; nomChauffeur: string; telephone: string; matriculeCamion: string }): Promise<Carrier> => {
    try {
      return await fetchJSON<Carrier>('/api/carriers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createCarrier(payload);
    }
  },

  updateCarrier: async (id: string, payload: Partial<Carrier>): Promise<Carrier> => {
    try {
      return await fetchJSON<Carrier>(`/api/carriers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.updateCarrier(id, payload);
    }
  },

  deleteCarrier: async (id: string): Promise<{ message: string }> => {
    try {
      return await fetchJSON<{ message: string }>(`/api/carriers/${id}`, {
        method: 'DELETE',
      });
    } catch {
      return localStore.deleteCarrier(id);
    }
  },

  scanVinOcr: async (imageDataUrl: string): Promise<{ vin: string; confidence: number; message: string }> => {
    try {
      return await fetchJSON<{ vin: string; confidence: number; message: string }>('/api/ai/scan-vin-ocr', {
        method: 'POST',
        body: JSON.stringify({ image: imageDataUrl }),
      });
    } catch {
      return localStore.scanVinOcr(imageDataUrl);
    }
  },

  getTruckLoads: async () => {
    try {
      return await fetchJSON<TruckLoad[]>('/api/truck-loads');
    } catch {
      return localStore.getTruckLoads();
    }
  },

  getTruckLoadById: async (id: string) => {
    try {
      return await fetchJSON<TruckLoad>(`/api/truck-loads/${id}`);
    } catch {
      return localStore.getTruckLoadById(id);
    }
  },

  createTruckLoad: async (payload: Parameters<typeof localStore.createTruckLoad>[0]) => {
    try {
      return await fetchJSON<TruckLoad>('/api/truck-loads', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      return localStore.createTruckLoad(payload);
    }
  },

  startTruckLoadTransit: async (id: string, user_id: string, user_name?: string) => {
    try {
      return await fetchJSON<TruckLoad>(`/api/truck-loads/${id}/start-transit`, {
        method: 'POST',
        body: JSON.stringify({ user_id, user_name }),
      });
    } catch {
      return localStore.startTruckLoadTransit(id, user_id, user_name);
    }
  },

  confirmTruckLoadReception: async (
    id: string,
    confirmations: { vin: string; reception_status: 'conforme' | 'absente' | 'endommagee' | 'refusee'; notes?: string }[],
    user_id: string,
    user_name?: string
  ) => {
    try {
      return await fetchJSON<TruckLoad>(`/api/truck-loads/${id}/confirm-reception`, {
        method: 'POST',
        body: JSON.stringify({ confirmations, user_id, user_name }),
      });
    } catch {
      return localStore.confirmTruckLoadReception(id, confirmations, user_id, user_name);
    }
  },

  cancelTruckLoad: async (id: string, user_id: string, user_name?: string, reason?: string) => {
    try {
      return await fetchJSON<TruckLoad>(`/api/truck-loads/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ user_id, user_name, reason }),
      });
    } catch {
      return localStore.cancelTruckLoad(id, user_id, user_name, reason);
    }
  },
};
