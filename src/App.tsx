import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { StudentsPage } from '@/pages/StudentsPage';
import { GuardiansPage } from '@/pages/GuardiansPage';
import { EnrollmentsPage } from '@/pages/EnrollmentsPage';
import { CoursesPage, ClassesPage } from '@/pages/CoursesPage';
import { TeachersPage } from '@/pages/TeachersPage';
import { RoomsPage } from '@/pages/RoomsPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { LessonsPage } from '@/pages/LessonsPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { FinancialPage } from '@/pages/FinancialPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { UnitsPage } from '@/pages/UnitsPage';
import { SettingsPage } from '@/pages/SettingsPage';

function App() {
  const [path, setPath] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || '/dashboard';
  });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace('#', '');
      setPath(hash || '/dashboard');
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((newPath: string) => {
    window.location.hash = newPath;
    setPath(newPath);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
  }, []);

  const renderPage = () => {
    if (path.startsWith('/dashboard')) return <DashboardPage onNavigate={navigate} />;
    if (path.startsWith('/students')) return <StudentsPage onNavigate={navigate} initialSearch={search} />;
    if (path.startsWith('/guardians')) return <GuardiansPage initialSearch={search} />;
    if (path.startsWith('/enrollments')) return <EnrollmentsPage initialSearch={search} />;
    if (path.startsWith('/courses')) return <CoursesPage />;
    if (path.startsWith('/classes')) return <ClassesPage />;
    if (path.startsWith('/teachers')) return <TeachersPage />;
    if (path.startsWith('/rooms')) return <RoomsPage />;
    if (path.startsWith('/schedules')) return <SchedulesPage />;
    if (path.startsWith('/lessons')) return <LessonsPage />;
    if (path.startsWith('/attendance')) return <AttendancePage />;
    if (path.startsWith('/financial')) return <FinancialPage />;
    if (path.startsWith('/reports')) return <ReportsPage onNavigate={navigate} />;
    if (path.startsWith('/units')) return <UnitsPage />;
    if (path.startsWith('/settings')) return <SettingsPage />;
    return <DashboardPage onNavigate={navigate} />;
  };

  return (
    <AppShell currentPath={path} onNavigate={navigate}>
      {renderPage()}
    </AppShell>
  );
}

export default App;
