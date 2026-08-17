import React, { useState } from 'react';
import {
  Receipt,
  X,
  CheckCircle2,
  DollarSign,
  Calendar,
  AlertCircle,
  RefreshCw,
  Building2,
  Car,
  FileCheck,
} from 'lucide-react';
import { Vehicle } from '../types';
import { api } from '../lib/api';
import { createInvoice } from '../lib/invoiceStore';
import { getImporterForBrand } from '../data/importers';

interface QuickBillVehicleModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const QuickBillVehicleModal: React.FC<QuickBillVehicleModalProps> = ({
  vehicle,
  onClose,
  onSuccess,
}) => {
  if (!vehicle) return null;

  const todayStr = new Date().toISOString().split('T')[0];

  // Auto-generate a suggested invoice number
  const yearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  const defaultInvoiceNumber = `FAC-${yearMonth}-${randomSuffix}`;

  const [invoiceNumber, setInvoiceNumber] = useState(
    vehicle.invoice_number || defaultInvoiceNumber
  );
  const [invoiceDate, setInvoiceDate] = useState(todayStr);
  const [amountHT, setAmountHT] = useState<number>(120);
  const [isPaid, setIsPaid] = useState<boolean>(vehicle.is_paid || false);
  const [paidDate, setPaidDate] = useState<string>(vehicle.paid_date || todayStr);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const brand = vehicle.brand || 'Inconnu';
  const model = vehicle.model || 'Inconnu';
  const chassis = vehicle.chassis_number || vehicle.vin || '';
  const importer = getImporterForBrand(brand);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      setErrorMsg('Veuillez saisir un numéro de facture valide.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Update vehicle record directly
      await api.updateVehicle(vehicle.id, {
        is_billed: true,
        invoice_number: invoiceNumber.trim(),
        is_paid: isPaid,
        paid_date: isPaid ? paidDate : undefined,
      });

      // 2. Also register in local invoice store so it syncs with Billing Module
      const subtotalHT = amountHT || 120;
      const tvaRate = 19;
      const tvaAmount = Math.round(subtotalHT * (tvaRate / 100) * 100) / 100;
      const timbre = 1.0;
      const totalTTC = Math.round((subtotalHT + tvaAmount + timbre) * 100) / 100;

      try {
        createInvoice({
          invoice_number: invoiceNumber.trim(),
          invoice_date: invoiceDate,
          due_date: invoiceDate,
          client_name: importer ? importer.name : `CLIENT ${brand.toUpperCase()}`,
          client_address: importer?.address || 'Tunis, Tunisie',
          client_mf: importer?.mf || '0000000/A/P/M/000',
          importer_id: importer?.id || 'stafim',
          site_id: vehicle.current_site_id || 'site_megrine',
          site_name: vehicle.site_arrivee || 'Parc Logistique',
          status: isPaid ? 'payee' : 'en_attente',
          paid_date: isPaid ? paidDate : undefined,
          payment_method: 'Virement bancaire',
          subtotal_ht: subtotalHT,
          tva_rate: tvaRate,
          tva_amount: tvaAmount,
          timbre_fiscal: timbre,
          total_ttc: totalTTC,
          notes: `Facturation directe du véhicule livré VIN: ${chassis} (${brand} ${model})`,
          items: [
            {
              id: `item_${Date.now()}`,
              description: `Prestation logistique & livraison véhicule ${brand} ${model} - VIN: ${chassis}`,
              quantity: 1,
              unitPriceHT: subtotalHT,
              totalHT: subtotalHT,
              tvaRate: tvaRate,
            },
          ],
        });
      } catch (storeErr) {
        console.warn('Billing store sync warning:', storeErr);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l enregistrement de la facture.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full border-2 border-amber-500 shadow-2xl overflow-hidden animate-scale-in">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b-2 border-amber-500">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 font-black">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                Facturer le Véhicule Livré
              </h3>
              <p className="text-[11px] text-amber-400 font-medium">
                Saisie de la facture &amp; règlement du véhicule
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5 text-xs text-slate-800">
          {errorMsg && (
            <div className="bg-rose-50 border-l-4 border-rose-500 p-3 text-rose-800 flex items-center space-x-2 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Vehicle Info Card */}
          <div className="bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-black text-blue-700 bg-blue-50 px-2 py-0.5 border border-blue-200">
                VIN: {chassis}
              </span>
              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black text-[10px] uppercase px-2 py-0.5">
                Statut: Livré
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-900 pt-1">
              <span>
                {brand} {model} {vehicle.color ? `(${vehicle.color})` : ''}
              </span>
              <span className="text-slate-500 text-[11px] font-normal">
                {vehicle.site_arrivee || 'Site Concession'}
              </span>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Invoice Number & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  N° de Facture <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <Receipt className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex: FAC-2026-001"
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold text-xs pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                  Date de Facturation
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold text-xs pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Amount HT */}
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block mb-1">
                Montant Prestation HT (DT / TND)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="0.001"
                  value={amountHT}
                  onChange={(e) => setAmountHT(parseFloat(e.target.value) || 0)}
                  placeholder="120.000"
                  className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-mono font-bold text-xs pl-8 pr-3 py-2 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Payment status checkbox */}
            <div className="bg-slate-50 p-3 border border-slate-200 space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPaid}
                  onChange={(e) => setIsPaid(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded-xs border-slate-300 focus:ring-emerald-500"
                />
                <span className="font-bold text-xs text-slate-900">
                  Marquer également la facture comme RÉGLÉE / PAYÉE
                </span>
              </label>

              {isPaid && (
                <div className="pt-2 pl-6 space-y-1 animate-fade-in">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 block">
                    Date de Règlement
                  </label>
                  <input
                    type="date"
                    value={paidDate}
                    onChange={(e) => setPaidDate(e.target.value)}
                    className="bg-white border border-slate-300 text-slate-900 font-bold text-xs px-3 py-1.5 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase transition"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center space-x-2 shadow-sm transition disabled:opacity-50"
            >
              {submitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileCheck className="w-4 h-4" />
              )}
              <span>Enregistrer la Facturation</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
