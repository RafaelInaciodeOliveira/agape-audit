'use client';

import { Bot, UserCheck, Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Attendant } from '../../lib/types';

interface Props {
  attendants: Attendant[];
  activeAttendantId: string;
  onSelect: (attendantId: string) => void;
}

// Seletor de atendente da lista de chats (fecha ao clicar fora).
export function AttendantDropdown({ attendants, activeAttendantId, onSelect }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center justify-between gap-2 bg-blue-600/10 hover:bg-blue-600/20 active:scale-[0.98] border border-blue-500/30 rounded-xl px-3 py-2.5 transition-all duration-200 focus:outline-none cursor-pointer"
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <Bot className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-sm font-semibold text-blue-300 truncate">
            {activeAttendantId === 'TODOS' || activeAttendantId === ''
              ? 'Todos os atendentes' 
              : attendants.find(a => a.id === activeAttendantId)?.name || 'Todos os atendentes'}
          </span>
        </div>
        <ChevronDown className={`w-4 h-4 text-blue-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100">
          <button
            onClick={() => { onSelect('TODOS'); setIsDropdownOpen(false); }}
            className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
              activeAttendantId === 'TODOS' || activeAttendantId === '' ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
            }`}
          >
            Todos os atendentes
            {(activeAttendantId === 'TODOS' || activeAttendantId === '') && <Check className="w-4 h-4 text-blue-400" />}
          </button>

          <div className="h-px bg-slate-800/80 my-1 mx-2"></div>

          {attendants.map((a: Attendant) => {
            const isSelected = activeAttendantId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => { onSelect(a.id); setIsDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected ? 'bg-blue-600/20 text-blue-300' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                   {a.name.includes('Ágape') ? <Bot className="w-3.5 h-3.5 opacity-70 shrink-0" /> : <UserCheck className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                   <span className="truncate">{a.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
