import { useMemo } from "react";

import Badge from "../../components/Badge/Badge";

import { useLanguage } from "../../i18n";
import { useCases } from "../../content/hooks";

import "./CasesHero.sass";

function CasesHero() {
  const { t } = useLanguage();
  const cases = useCases();

  // Публічні кейси (з обкладинкою) — з перекладеного списку
  const publicCases = useMemo(
    () => cases.filter((caseItem) => caseItem.image),
    [cases],
  );

  return (
    <section className="cases-hero">
      <div className="cases-hero__glow" />

      <div className="cases-hero__container">
        <Badge className="cases-hero__label">
          {t("casesPage.badge", { count: publicCases.length })}
        </Badge>

        <h1 className="cases-hero__title">
          {t("casesPage.titleStart")}
          <span>{t("casesPage.titleAccent")}</span>
        </h1>

        <p className="cases-hero__description">{t("casesPage.description")}</p>
      </div>
    </section>
  );
}

export default CasesHero;
