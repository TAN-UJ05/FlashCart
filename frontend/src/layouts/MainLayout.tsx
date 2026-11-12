import { Outlet } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { Footer } from '../components/layout/Footer';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8FA]">
      <Header />
      <main className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
