import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";

import ScrollToHash from "./components/ScrollToHash/ScrollToHash";

import { LANGUAGES, LanguageLayout } from "./i18n";

import Home from "./pages/Home/Home";
// Головна вантажиться одразу, решта сторінок — окремими файлами при переході
const Cases = lazy(() => import("./pages/Cases/Cases"));
const CasePage = lazy(() => import("./pages/CasePage/CasePage"));
const Blog = lazy(() => import("./pages/Blog/Blog"));
const BlogArticlePage = lazy(
  () => import("./pages/BlogArticlePage/BlogArticlePage"),
);
const Team = lazy(() => import("./pages/Team/Team"));
const Contacts = lazy(() => import("./pages/Contacts/Contacts"));
const ServicePage = lazy(() => import("./pages/ServicePage/ServicePage"));
const LegalPage = lazy(() => import("./pages/LegalPage/LegalPage"));
import { LEGAL_SLUGS } from "./content/api";

/** Сторінки сайту — однакові для всіх мов */
const pageRoutes = (
  <>
    <Route index element={<Home />} />

    <Route path="cases" element={<Cases />} />
    <Route path="cases/:slug" element={<CasePage />} />

    <Route path="blog" element={<Blog />} />
    <Route path="blog/:slug" element={<BlogArticlePage />} />

    <Route path="team" element={<Team />} />
    <Route path="contacts" element={<Contacts />} />

    <Route path="services/:slug" element={<ServicePage />} />

    {LEGAL_SLUGS.map((slug) => (
      <Route key={slug} path={slug} element={<LegalPage slug={slug} />} />
    ))}
  </>
);

function App() {
  return (
    <>
      <ScrollToHash />

      {/* "/..." — українська, "/ru/..." — російська, "/en/..." — англійська */}
      <Suspense fallback={null}>
        <Routes>
          {LANGUAGES.map(({ code, prefix }) => (
            <Route
              key={code}
              path={prefix || "/"}
              element={<LanguageLayout lang={code} />}
            >
              {pageRoutes}
            </Route>
          ))}
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
