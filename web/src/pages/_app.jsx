import { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import '../styles/globals.css';

export default function App({ Component, pageProps }) {
  const [activeTab, setActiveTab] = useState('universe');

  return (
    <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
      <Component {...pageProps} activeTab={activeTab} onTabChange={setActiveTab} />
    </AppShell>
  );
}
