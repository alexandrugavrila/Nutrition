import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import { DataProvider } from "./contexts/DataContext";
import MainLayout from "./components/layout/MainLayout";
import DataPage from "./components/data/DataPage";
import Planning from "./components/planning/Planning";
import Shopping from "./components/shopping/Shopping";
import Cooking from "./components/cooking/Cooking";
import Logging from "./components/logging/Logging";

import "./styles/App.css";

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <DataProvider>
        <MainLayout>
          <Routes>
            <Route path="/" element={<DataPage />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/planning" element={<Planning />} />
            <Route path="/shopping" element={<Shopping />} />
            <Route path="/cooking" element={<Cooking />} />
            <Route path="/logging" element={<Logging />} />
          </Routes>
        </MainLayout>
      </DataProvider>
    </Router>
  );
}

export default App;
