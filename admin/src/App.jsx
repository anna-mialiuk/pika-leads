import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./components/Layout";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Team from "./pages/Team";
import { useAuth } from "./lib/auth";
import { MetaProvider } from "./lib/meta";

function Protected({ children, admin = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && user.role !== "admin") return <Navigate to="/leads" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <MetaProvider>
              <Layout />
            </MetaProvider>
          </Protected>
        }
      >
        <Route path="/leads" element={<Leads />} />
        <Route path="/leads/:id" element={<Leads />} />
        <Route
          path="/team"
          element={
            <Protected admin>
              <Team />
            </Protected>
          }
        />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  );
}

export default App;
