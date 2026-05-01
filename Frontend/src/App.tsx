import React, { Suspense, lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import LoginPage from "@/components/auth/LoginPage";
import { DataProvider } from "@/contexts/DataContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import MainLayout from "@/components/layout/MainLayout";

import "@/styles/App.css";

const DataPage = lazy(() => import("@/components/data/DataPage"));
const Planning = lazy(() => import("@/components/planning/Planning"));
const Shopping = lazy(() => import("@/components/shopping/Shopping"));
const Cooking = lazy(() => import("@/components/cooking/Cooking"));
const Logging = lazy(() => import("@/components/logging/Logging"));

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading…</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <DataProvider>
      <MainLayout>
        <Suspense fallback={<div className="page-loading">Loading…</div>}>
          <Routes>
            <Route path="/" element={<DataPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/cooking" element={<Cooking />} />
            <Route path="/logging" element={<Logging />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </DataProvider>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </Router>
  );
}

export default App;
