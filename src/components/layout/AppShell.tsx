import { type ReactNode, useState, useCallback } from 'react';
import { Sidebar, Topbar } from '@/components/layout/Sidebar';

type AppShellProps = {
  children: ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
  onSearch: (query: string) => void;
};

export function AppShell({ children, currentPath, onNavigate, onSearch }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSearch = useCallback((query: string) => {
    onSearch(query);
  }, [onSearch]);

  return (
    <div className="min-h-screen bg-surface-base">
      <Sidebar
        currentPath={currentPath}
        onNavigate={onNavigate}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="lg:ml-sidebar">
        <Topbar onMenuClick={() => setMobileOpen(true)} onSearch={handleSearch} />
        <main className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
