import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MaterialQuery from './pages/inventory/MaterialQuery';
import SurplusQuery from './pages/inventory/SurplusQuery';
import MaterialOut from './pages/outbound/MaterialOut';
import SurplusOut from './pages/outbound/SurplusOut';
import MaterialIn from './pages/inbound/MaterialIn';
import SurplusIn from './pages/inbound/SurplusIn';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory/material" element={<MaterialQuery />} />
        <Route path="inventory/surplus" element={<SurplusQuery />} />
        <Route path="outbound/material" element={<MaterialOut />} />
        <Route path="outbound/surplus" element={<SurplusOut />} />
        <Route path="inbound/material" element={<MaterialIn />} />
        <Route path="inbound/surplus" element={<SurplusIn />} />
      </Route>
    </Routes>
  );
}

export default App;
