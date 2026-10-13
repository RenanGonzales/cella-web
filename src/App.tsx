import { useState } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { AreaPage } from './pages/AreaPage';
import { DemoPage } from './pages/DemoPage';
import { HomePage } from './pages/HomePage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';
import { MarketPlanPage } from './pages/MarketPlanPage';
import { MarketsPage } from './pages/MarketsPage';
import { ProductsPage } from './pages/ProductsPage';
import { SoonPage } from './pages/SoonPage';
import { WelcomePage } from './pages/WelcomePage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

/** Skips the login page for visitors already logged in when they arrive. Logging in from
 * the page is left to the page itself, which decides where to go (home or the demo intro). */
function GuestOnly({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const [loggedInOnArrival] = useState(isLoggedIn);
  return loggedInOnArrival ? <Navigate to="/" replace /> : children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/welcome"
        element={
          <RequireAuth>
            <WelcomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/demo"
        element={
          <RequireAuth>
            <DemoPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="areas/:areaId" element={<AreaPage />} />
        <Route path="list" element={<ListPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="markets" element={<MarketsPage />} />
        <Route path="markets/:marketId" element={<MarketPlanPage />} />
        <Route path="history" element={<SoonPage titleKey="nav.history" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AppRoutes />
    </BrowserRouter>
  );
}
