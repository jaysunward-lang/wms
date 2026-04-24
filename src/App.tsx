import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import EntryPage from './pages/EntryPage';
import Dashboard from './pages/Dashboard';
import MaterialQuery from './pages/inventory/MaterialQuery';
import SurplusQuery from './pages/inventory/SurplusQuery';
import MaterialOut from './pages/outbound/MaterialOut';
import SurplusOut from './pages/outbound/SurplusOut';
import MaterialIn from './pages/inbound/MaterialIn';
import SurplusIn from './pages/inbound/SurplusIn';
import PhotoGallery from './pages/PhotoGallery';
import MobileHome from './pages/mobile/MobileHome';
import MobileCamera from './pages/mobile/MobileCamera';
import MobileInbound from './pages/mobile/MobileInbound';

function RootRedirect() {
  const user = localStorage.getItem('wms_user');
  const mode = localStorage.getItem('wms_mode');
  if (!user || !mode) return <Navigate to="/entry" replace />;
  return <Navigate to={mode === 'mobile' ? '/mobile' : '/dashboard'} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/entry" element={<EntryPage />} />
      <Route index element={<RootRedirect />} />
      {/* 电脑端 */}
      <Route path="/" element={<MainLayout />}>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="inventory/material" element={<MaterialQuery />} />
        <Route path="inventory/surplus" element={<SurplusQuery />} />
        <Route path="outbound/material" element={<MaterialOut />} />
        <Route path="outbound/surplus" element={<SurplusOut />} />
        <Route path="inbound/material" element={<MaterialIn />} />
        <Route path="inbound/surplus" element={<SurplusIn />} />
        <Route path="photos" element={<PhotoGallery />} />
      </Route>
      {/* 手机端 */}
      <Route path="/mobile" element={<MobileHome />} />
      <Route path="/mobile/camera" element={<MobileCamera />} />
      <Route path="/mobile/inbound" element={<MobileInbound />} />
    </Routes>
  );
}

export default App;
