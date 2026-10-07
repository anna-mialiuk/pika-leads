import { useMemo, useState } from "react";

import Layout from "../../components/Layout/Layout";
import CaseCard from "../../components/CaseCard/CaseCard";
import FilterGroup from "../../components/FilterGroup/FilterGroup";

import CasesHero from "../../sections/CasesHero/CasesHero";

import { Seo, useLanguage, useData } from "../../i18n";
import { useCases } from "../../content/hooks";
import { countBy, matches } from "../../utils/countBy";

import "./Cases.sass";

function Cases() {
  const { t } = useLanguage();
  const cases = useCases();

  // Публічні кейси (з обкладинкою) — з перекладеного списку
  const publicCases = useMemo(
    () => cases.filter((caseItem) => caseItem.image),
    [cases],
  );
  const { trafficSources, caseNiches } = useData("casesPageData");

  const [activeSource, setActiveSource] = useState("all");
  const [activeNiche, setActiveNiche] = useState("all");

  const filteredCases = useMemo(
    () =>
      publicCases.filter(
        (item) =>
          matches(item.source, activeSource) &&
          matches(item.niche, activeNiche),
      ),
    [publicCases, activeSource, activeNiche],
  );

  // Лічильники для кожного фільтра рахуються з урахуванням іншого фільтра
  const sourceCounts = useMemo(
    () =>
      countBy(
        publicCases.filter((item) => matches(item.niche, activeNiche)),
        "source",
      ),
    [publicCases, activeNiche],
  );

  const nicheCounts = useMemo(
    () =>
      countBy(
        publicCases.filter((item) => matches(item.source, activeSource)),
        "niche",
      ),
    [publicCases, activeSource],
  );

  return (
    <Layout className="cases-page">
      <Seo
        title={t("seo.cases.title")}
        description={t("seo.cases.description")}
      />

      <CasesHero />

      <section className="cases-content">
        <div className="cases-content__container">
          <div className="cases-content__filters">
            <FilterGroup
              label={t("casesPage.sourceFilter")}
              items={trafficSources}
              active={activeSource}
              counts={sourceCounts}
              onChange={setActiveSource}
            />

            <FilterGroup
              label={t("casesPage.nicheFilter")}
              items={caseNiches}
              active={activeNiche}
              counts={nicheCounts}
              onChange={setActiveNiche}
            />
          </div>

          <div className="cases-content__list">
            {filteredCases.map((item) => (
              <CaseCard key={item.id} {...item} />
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

export default Cases;
