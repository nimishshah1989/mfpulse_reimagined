import { useRouter } from 'next/router';
import AppShell from '../components/layout/AppShell';
import ErrorBoundary from '../components/shared/ErrorBoundary';
import { FilterProvider } from '../contexts/FilterContext';
import '../styles/globals.css';

const PATH_TO_TAB = {
  '/': 'dashboard',
  '/dashboard': 'dashboard',
  '/universe': 'universe',
  '/fund360': 'fund360',
  '/sectors': 'sectors',
  '/strategy': 'strategies',
  '/strategies': 'strategies',
  '/simulation': 'strategies',  // Simulate merged into Strategy Builder
  '/methodology': 'methodology',
  '/admin': 'admin',
};

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router.pathname || '/';
  const activeTab = PATH_TO_TAB[pathname] || 'universe';

  const handleTabChange = (tab) => {
    const route = tab === 'dashboard' ? '/' : `/${tab}`;
    router.push(route);
  };

  return (
    <FilterProvider>
      <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
        <ErrorBoundary key={activeTab}>
          <Component {...pageProps} />
        </ErrorBoundary>
      </AppShell>
    </FilterProvider>
  );
}
