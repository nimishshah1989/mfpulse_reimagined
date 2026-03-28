import { useRouter } from 'next/router';
import AppShell from '../components/layout/AppShell';
import '../styles/globals.css';

const PATH_TO_TAB = {
  '/': 'universe',
  '/universe': 'universe',
  '/fund360': 'fund360',
  '/sectors': 'sectors',
  '/simulation': 'simulation',
  '/strategy': 'strategy',
  '/dashboard': 'dashboard',
};

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const pathname = router.pathname || '/';
  const activeTab = PATH_TO_TAB[pathname] || 'universe';

  const handleTabChange = (tab) => {
    const route = tab === 'universe' ? '/' : `/${tab}`;
    router.push(route);
  };

  return (
    <AppShell activeTab={activeTab} onTabChange={handleTabChange}>
      <Component {...pageProps} />
    </AppShell>
  );
}
