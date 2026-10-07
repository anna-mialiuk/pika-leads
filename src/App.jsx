import { Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import ScrollToHash from "./components/ScrollToHash/ScrollToHash";

import { LANGUAGES, LanguageLayout } from "./i18n";

import Home from "./pages/Home/Home";
import Cases from "./pages/Cases/Cases";
import CasePage from "./pages/CasePage/CasePage";
import Blog from "./pages/Blog/Blog";
import BlogArticlePage from "./pages/BlogArticlePage/BlogArticlePage";
import Team from "./pages/Team/Team";
import Contacts from "./pages/Contacts/Contacts";
import ServicePage from "./pages/ServicePage/ServicePage";
import LegalPage from "./pages/LegalPage/LegalPage";
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
