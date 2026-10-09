import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Layout from "./components/Layout";
import Leads from "./pages/Leads";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Team from "./pages/Team";
import ContentList from "./pages/ContentList";
import ContentEditor from "./pages/ContentEditor";
import Reviews from "./pages/Reviews";
import Analytics from "./pages/Analytics";
import Seo from "./pages/Seo";
import Integrations from "./pages/Integrations";
import { PublishProvider } from "./lib/publish";
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
              <PublishProvider>
                <Layout />
              </PublishProvider>
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
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        {[
          ["/cases", <ContentList collection="cases" key="cases" />],
          ["/cases/:id", <ContentEditor collection="cases" key="case" />],
          ["/blog", <ContentList collection="articles" key="articles" />],
          ["/blog/:id", <ContentEditor collection="articles" key="article" />],
          ["/reviews", <Reviews key="reviews" />],
          ["/seo", <Seo key="seo" />],
          ["/integrations", <Integrations key="integrations" />],
        ].map(([path, element]) => (
          <Route key={path} path={path} element={<Protected admin>{element}</Protected>} />
        ))}
      </Route>
      <Route path="*" element={<Navigate to="/leads" replace />} />
    </Routes>
  );
}

export default App;
