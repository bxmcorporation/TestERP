import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard, Users, UserCog, GraduationCap, BookOpen,
  CalendarDays, Wallet, Settings, Building2, ChevronDown,
  ClipboardList, UserPlus, School, Clock, FileText, BarChart3,
  ShieldCheck, Bell, Search, Menu, X,
} from 'lucide-react';

export type NavItem = {
  key: string;
  label: string;
  icon: ReactNode;
  path: string;
};

export type NavSection = {
  key: string;
  label: string;
  items: NavItem[];
};

const sections: NavSection[] = [
  {
    key: 'overview',
    label: 'Visao Geral',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, path: '/dashboard' },
    ],
  },
  {
    key: 'academic',
    label: 'Gestao Academica',
    items: [
      { key: 'students', label: 'Alunos', icon: <Users size={18} />, path: '/students' },
      { key: 'guardians', label: 'Responsaveis', icon: <UserCog size={18} />, path: '/guardians' },
      { key: 'enrollments', label: 'Matriculas', icon: <ClipboardList size={18} />, path: '/enrollments' },
      { key: 'courses', label: 'Cursos', icon: <GraduationCap size={18} />, path: '/courses' },
      { key: 'classes', label: 'Turmas', icon: <School size={18} />, path: '/classes' },
      { key: 'teachers', label: 'Professores', icon: <UserPlus size={18} />, path: '/teachers' },
      { key: 'rooms', label: 'Salas', icon: <Building2 size={18} />, path: '/rooms' },
      { key: 'schedules', label: 'Horarios', icon: <Clock size={18} />, path: '/schedules' },
    ],
  },
  {
    key: 'teaching',
    label: 'Ensino',
    items: [
      { key: 'lessons', label: 'Aulas', icon: <BookOpen size={18} />, path: '/lessons' },
      { key: 'attendance', label: 'Frequencia', icon: <CalendarDays size={18} />, path: '/attendance' },
    ],
  },
  {
    key: 'admin',
    label: 'Administracao',
    items: [
      { key: 'financial', label: 'Financeiro', icon: <Wallet size={18} />, path: '/financial' },
      { key: 'reports', label: 'Relatorios', icon: <BarChart3 size={18} />, path: '/reports' },
    ],
  },
  {
    key: 'system',
    label: 'Sistema',
    items: [
      { key: 'units', label: 'Unidades', icon: <Building2 size={18} />, path: '/units' },
      { key: 'settings', label: 'Configuracoes', icon: <Settings size={18} />, path: '/settings' },
    ],
  },
];

type SidebarProps = {
  currentPath: string;
  onNavigate: (path: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function Sidebar({ currentPath, onNavigate, mobileOpen, onMobileClose }: SidebarProps) {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleNavigate = (path: string) => {
    onNavigate(path);
    onMobileClose();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-sidebar bg-surface-raised border-r border-edge shadow-xl
        flex flex-col transition-transform duration-300 lg:translate-x-0
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo */}
        <div className="h-topbar flex items-center gap-3 px-5 border-b border-edge shrink-0">
          <div className="w-9 h-9 rounded-lg bg-rayon-orange/10 border border-rayon-orange/20 flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-5 h-5" fill="none">
              <path d="M8 22L16 8L24 22" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="22" r="2" fill="#F97316" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-display font-bold text-gray-900 tracking-wide">RAYON OS</h1>
            <p className="text-[10px] text-gray-300 font-body">Gestao Educacional</p>
          </div>
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          {sections.map((section) => {
            const isCollapsed = collapsedSections.has(section.key);
            const hasActive = section.items.some((item) => currentPath.startsWith(item.path));

            return (
              <div key={section.key} className="mb-1">
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider
                    ${hasActive ? 'text-gray-600' : 'text-gray-400'} hover:text-gray-500 transition-colors`}
                >
                  {section.label}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
                {!isCollapsed && (
                  <div className="mt-1 space-y-0.5">
                    {section.items.map((item) => {
                      const active = currentPath.startsWith(item.path);
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleNavigate(item.path)}
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-150
                            ${active
                              ? 'bg-rayon-orange/10 text-gray-900 border border-rayon-orange/20'
                              : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
                            }`}
                        >
                          <span className={active ? 'text-rayon-orange' : 'text-gray-400'}>
                            {item.icon}
                          </span>
                          {item.label}
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rayon-orange" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-edge p-3 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-edge">
            <div className="w-8 h-8 rounded-full bg-rayon-orange/20 border border-rayon-orange/30 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} className="text-rayon-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-700 truncate">Administrador</p>
              <p className="text-[10px] text-gray-300 truncate">Ambiente de Demonstracao</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

type TopbarProps = {
  onMenuClick: () => void;
  onSearch: (query: string) => void;
};

export function Topbar({ onMenuClick, onSearch }: TopbarProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <header className="sticky top-0 z-30 h-topbar bg-surface-base/80 backdrop-blur-xl border-b border-edge flex items-center gap-4 px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => {
              setSearchValue(e.target.value);
              onSearch(e.target.value);
            }}
            placeholder="Buscar alunos, turmas, matriculas..."
            className="input-base w-full pl-9"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="relative p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rayon-orange" />
        </button>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 border border-edge">
          <FileText size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400">Demonstracao</span>
        </div>
      </div>
    </header>
  );
}
