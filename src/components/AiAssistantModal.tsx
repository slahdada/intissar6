import React, { useState } from 'react';
import { Sparkles, X, Send, Copy, Check, Bot, RefreshCw, FileText, FileSpreadsheet } from 'lucide-react';
import { api } from '../lib/api';

interface AiAssistantModalProps {
  onClose: () => void;
  onSelectChassis?: (chassis: string) => void;
  onOpenCsvAudit?: () => void;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({ onClose, onSelectChassis, onOpenCsvAudit }) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendPrompt = async (promptToSend?: string) => {
    const query = promptToSend || inputPrompt;
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const res = await api.aiAssistant(query.trim());
      setResponse(res.text);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l appel à l IA Gemini.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const samplePrompts = [
    'Analyser ce bon de livraison et extraire les châssis VIN 17 caractères :',
    'Résumer l état général des stocks du Parc STAFIM et de l entrepôt Mghira',
    'Rédiger une note de transfert de 5 véhicules du Port de La Goulette vers Megrine',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none">
      <div className="bg-white shadow-2xl max-w-2xl w-full border-2 border-slate-900 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b-4 border-blue-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 text-white">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-100">Assistant IA Logistique Gemini</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Analyse de manifestes, extraction VIN & synthèse du parc</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {onOpenCsvAudit && (
            <div className="bg-slate-900 text-white p-3 border-l-4 border-emerald-500 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-100 text-xs">Audit & Reconciliation CSV Volumineux (3 Fichiers)</p>
                  <p className="text-[10px] text-slate-400">Contrôle qualité, schéma JSON, anomalies et 3 exports CSV propres.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenCsvAudit}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase px-3 py-1.5 transition shrink-0"
              >
                Ouvrir l Auditeur CSV
              </button>
            </div>
          )}

          {/* Preset Chips */}
          <div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
              Exemples de requêtes rapides :
            </span>
            <div className="flex flex-wrap gap-2">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInputPrompt(p);
                    handleSendPrompt(p);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1 text-left transition border border-slate-300 font-bold text-[11px]"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Input Box */}
          <div className="space-y-2">
            <textarea
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Collez ici un extrait de manifeste de livraison, une liste de VINs ou posez une question sur l organisation du stock..."
              rows={4}
              className="w-full p-3 bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:border-blue-600 font-medium text-xs"
            />
            <div className="flex justify-end">
              <button
                onClick={() => handleSendPrompt()}
                disabled={loading || !inputPrompt.trim()}
                className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 text-xs font-black uppercase tracking-wider transition disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Envoyer la demande</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border-l-4 border-rose-600 border-y border-r border-rose-200 text-xs text-rose-900 font-bold">
              {error}
            </div>
          )}

          {/* Response Box */}
          {response && (
            <div className="bg-slate-900 text-slate-100 p-4 border-b-4 border-blue-600 space-y-2 relative">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-black text-blue-400 flex items-center space-x-1.5 uppercase text-xs tracking-wider">
                  <Bot className="w-4 h-4" />
                  <span>Réponse de l Assistant IA</span>
                </span>
                <button
                  onClick={handleCopy}
                  className="text-slate-400 hover:text-white flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié' : 'Copier'}</span>
                </button>
              </div>
              <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs text-slate-200 pt-1">
                {response}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-100 p-3 border-t border-slate-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 text-white text-xs font-black uppercase tracking-wider hover:bg-slate-800 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
