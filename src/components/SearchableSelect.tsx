import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, Pencil, Trash2 } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  error?: boolean;
  allowCustom?: boolean;
  customAddText?: string;
  size?: 'sm' | 'md';
  onAddCustom?: (searchTerm: string) => void;
  onEditOption?: (option: SelectOption) => void;
  onDeleteOption?: (option: SelectOption) => void;
  isAdmin?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Sélectionner...',
  searchPlaceholder = 'Rechercher...',
  disabled = false,
  required = false,
  className = '',
  error = false,
  allowCustom = false,
  customAddText = 'Ajouter',
  size = 'md',
  onAddCustom,
  onEditOption,
  onDeleteOption,
  isAdmin = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value || opt.label.toLowerCase() === value.toLowerCase());
  const displayLabel = selectedOption ? selectedOption.label : value;

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const trimmedSearch = searchTerm.trim();
  const hasExactMatch = options.some(
    (opt) => opt.label.toLowerCase() === trimmedSearch.toLowerCase() || opt.value.toLowerCase() === trimmedSearch.toLowerCase()
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const handleCustomClick = () => {
    if (onAddCustom) {
      onAddCustom(trimmedSearch);
      setIsOpen(false);
      setSearchTerm('');
    } else {
      handleSelect(trimmedSearch);
    }
  };

  const pyClass = size === 'sm' ? 'py-1.5 px-2.5' : 'py-2.5 px-3.5';

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Target Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left bg-white border text-xs flex items-center justify-between transition rounded-lg shadow-xs ${pyClass} ${
          error
            ? 'border-red-500 focus:ring-2 focus:ring-red-200'
            : isOpen
            ? 'border-indigo-600 ring-2 ring-indigo-100'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="truncate pr-2">
          {displayLabel ? (
            <div>
              <span className="font-semibold text-slate-900 block truncate">{displayLabel}</span>
              {selectedOption?.sublabel && (
                <span className="text-[10px] text-slate-500 font-normal block truncate">
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          {value && !disabled && !required && (
            <span
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700"
              title="Effacer la sélection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-300 shadow-xl overflow-hidden rounded-lg text-xs">
          {/* Search Bar */}
          <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center space-x-2">
            <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="text-slate-400 hover:text-slate-600 text-[10px] uppercase font-bold"
              >
                Effacer
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
            {allowCustom && trimmedSearch && !hasExactMatch && (
              <div
                onClick={handleCustomClick}
                className="p-2.5 bg-indigo-50/70 hover:bg-indigo-100/80 text-indigo-900 font-bold cursor-pointer transition flex items-center justify-between border-b border-indigo-100"
              >
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">+</span>
                  <span className="truncate">{customAddText} "{trimmedSearch}"</span>
                </div>
                {!isAdmin && (
                  <span className="ml-2 text-[10px] font-semibold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded shrink-0">
                    Admin requis
                  </span>
                )}
              </div>
            )}

            {filteredOptions.length === 0 && (!allowCustom || !trimmedSearch) ? (
              <div className="p-4 text-center text-slate-400 italic">
                Aucun résultat correspondant
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value || opt.label.toLowerCase() === value.toLowerCase();
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className={`p-2.5 cursor-pointer transition flex items-center justify-between ${
                      isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold flex items-center space-x-2">
                        <span>{opt.label}</span>
                      </div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-slate-500 font-normal">{opt.sublabel}</div>
                      )}
                      {opt.description && (
                        <div className="text-[10px] text-slate-400 font-normal">{opt.description}</div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 mr-1 flex-shrink-0" />}
                      {onEditOption && (
                        <button
                          type="button"
                          title="Modifier"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onEditOption(opt);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-200/60 rounded transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteOption && (
                        <button
                          type="button"
                          title="Supprimer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onDeleteOption(opt);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
