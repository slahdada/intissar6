import React, { useState } from 'react';
import {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
} from '../lib/firebase';
import { getAuthErrorFrenchMessage } from '../lib/cloudSyncStore';
import { KeyRound, Mail, User, ShieldCheck, ArrowRight, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface AuthScreenProps {
  onDemoLogin?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onDemoLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isApiKeyError, setIsApiKeyError] = useState(false);
  const [isAuthDisabledError, setIsAuthDisabledError] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApiKeyError(false);
    setIsAuthDisabledError(false);

    if (!email.trim()) {
      setErrorMessage('Veuillez saisir votre adresse e-mail.');
      return;
    }

    if (mode !== 'forgot' && !password) {
      setErrorMessage('Veuillez saisir votre mot de passe.');
      return;
    }

    if (mode === 'signup') {
      if (!fullName.trim()) {
        setErrorMessage('Veuillez saisir votre nom complet.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Le mot de passe doit contenir au moins 6 caractères.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Les mots de passe ne correspondent pas.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (userCred.user) {
          await updateProfile(userCred.user, { displayName: fullName.trim() });
        }
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setSuccessMessage('Un e-mail de réinitialisation vous a été envoyé. Vérifiez votre boîte de réception.');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      const code = err.code || (err.message && err.message.includes('api-key-not-valid') ? 'auth/api-key-not-valid' : '');

      const isCustomActive = typeof window !== 'undefined' && localStorage.getItem('use_custom_firebase') === 'true';
      if (isCustomActive && (code === 'auth/operation-not-allowed' || code.includes('api-key-not-valid') || (err.message && err.message.includes('operation-not-allowed')))) {
        localStorage.removeItem('use_custom_firebase');
        localStorage.setItem('force_aistudio_firebase', 'true');
        window.location.reload();
        return;
      }

      if (code.includes('api-key-not-valid') || code.includes('invalid-api-key') || (err.message && err.message.includes('api-key-not-valid'))) {
        setIsApiKeyError(true);
      }
      if (code === 'auth/operation-not-allowed' || (err.message && err.message.includes('operation-not-allowed'))) {
        setIsAuthDisabledError(true);
      }
      setErrorMessage(getAuthErrorFrenchMessage(code));
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToAiStudioConfig = () => {
    localStorage.removeItem('use_custom_firebase');
    localStorage.setItem('force_aistudio_firebase', 'true');
    window.location.reload();
  };

  const handleSwitchToCustomFirebase = () => {
    localStorage.setItem('use_custom_firebase', 'true');
    localStorage.removeItem('force_aistudio_firebase');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 shadow-2xl rounded-none overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-950 border-b border-slate-800 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-600/10 border border-blue-500/30 mb-3">
            <div className="w-6 h-6 border-2 border-blue-500 rotate-45 flex items-center justify-center">
              <div className="w-2 h-2 bg-white"></div>
            </div>
          </div>
          <h1 className="text-xl font-black uppercase tracking-wider text-white">
            Gestion Parc <span className="text-blue-500">Véhicules</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {mode === 'login' && 'Connexion sécurisée à votre compte Cloud'}
            {mode === 'signup' && 'Création de votre compte utilisateur Cloud'}
            {mode === 'forgot' && 'Réinitialisation de votre mot de passe'}
          </p>
        </div>

        {/* Feedback Banners */}
        {errorMessage && (
          <div className="p-4 bg-red-950/90 border-b border-red-800 text-red-200 text-xs space-y-3">
            <div className="flex items-start space-x-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>

            {isApiKeyError && (
              <div className="pt-2 border-t border-red-900/60 space-y-2">
                <p className="text-[11px] text-red-300">
                  La clé API saisie dans la configuration Firebase n'est pas valide ou n'est pas activée sur la console Firebase.
                </p>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSwitchToAiStudioConfig}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition text-center border border-blue-400/30"
                  >
                    Basculer sur le serveur Firebase AI Studio (Valide)
                  </button>
                  {onDemoLogin && (
                    <button
                      type="button"
                      onClick={onDemoLogin}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition text-center border border-slate-700"
                    >
                      Accéder directement en Mode Démo
                    </button>
                  )}
                </div>
              </div>
            )}

            {isAuthDisabledError && (
              <div className="pt-2 border-t border-red-900/60 space-y-2">
                <p className="text-[11px] text-red-300 leading-relaxed">
                  L'authentification par <strong>E-mail / Mot de passe</strong> n'est pas encore activée dans la console Firebase du projet <code className="bg-red-900/50 px-1 text-white">gestion-parc-vehicules-c872d</code>.
                </p>
                <div className="p-2 bg-slate-900 border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <p className="font-semibold text-amber-400">Pour l'activer dans votre console Firebase :</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                    <li>Allez sur <strong>Firebase Console &gt; Authentication</strong></li>
                    <li>Cliquez sur l'onglet <strong>Sign-in method</strong></li>
                    <li>Sélectionnez <strong>E-mail / Mot de passe</strong> et cliquez sur <strong>Activer</strong></li>
                  </ol>
                </div>
                <div className="flex flex-col gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSwitchToAiStudioConfig}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition text-center border border-blue-400/30"
                  >
                    Basculer sur le serveur Firebase AI Studio (Valide & Opérationnel)
                  </button>
                  {onDemoLogin && (
                    <button
                      type="button"
                      onClick={onDemoLogin}
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[11px] uppercase tracking-wider py-2 px-3 transition text-center border border-slate-700"
                    >
                      Accéder directement en Mode Démo
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-emerald-950/80 border-b border-emerald-800 text-emerald-200 text-xs font-semibold flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                Nom complet
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Ayari Intissar"
                  className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
              Adresse E-mail
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: utilisateur@parc-stafim.tn"
                className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300">
                  Mot de passe
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider text-blue-400 hover:text-blue-300"
                  >
                    Mot de passe oublié ?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300 mb-1">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 text-white placeholder-slate-500 text-xs pl-9 pr-3 py-2.5 focus:outline-none focus:border-blue-500 font-mono"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-black uppercase tracking-wider py-3 flex items-center justify-center space-x-2 transition shadow-lg mt-2"
          >
            {loading ? (
              <span>Traitement en cours...</span>
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Se connecter'}
                  {mode === 'signup' && 'Créer mon compte'}
                  {mode === 'forgot' && 'Envoyer le lien par e-mail'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onDemoLogin && (
            <button
              type="button"
              onClick={onDemoLogin}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider py-2.5 flex items-center justify-center space-x-2 transition border border-slate-700 mt-2"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Accéder en Mode Démo (Sans Firebase)</span>
            </button>
          )}
        </form>

        {/* Footer Navigation */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center space-y-3">
          {mode === 'login' && (
            <p className="text-xs text-slate-400">
              Vous n'avez pas encore de compte ?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-blue-400 hover:text-blue-300 uppercase text-[11px] tracking-wider ml-1 underline"
              >
                S'inscrire
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="text-xs text-slate-400">
              Vous possédez déjà un compte ?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="font-bold text-blue-400 hover:text-blue-300 uppercase text-[11px] tracking-wider ml-1 underline"
              >
                Se connecter
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="font-bold text-slate-400 hover:text-white uppercase text-[11px] tracking-wider underline"
            >
              Retour à la page de connexion
            </button>
          )}

          <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] text-slate-500">
            <span>
              Projet: {typeof window !== 'undefined' && localStorage.getItem('use_custom_firebase') === 'true' ? 'gestion-parc-vehicules-c872d' : 'AI Studio Cloud (Inclus)'}
            </span>
            {typeof window !== 'undefined' && localStorage.getItem('use_custom_firebase') === 'true' ? (
              <button
                type="button"
                onClick={handleSwitchToAiStudioConfig}
                className="text-blue-400 hover:underline"
              >
                Passer sur le serveur AI Studio (Actif)
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSwitchToCustomFirebase}
                className="text-slate-400 hover:underline"
              >
                Utiliser votre projet Firebase
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
