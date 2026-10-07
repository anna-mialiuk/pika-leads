import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import CaseCard from "../../components/CaseCard/CaseCard";
import { useLanguage } from "../../i18n";
import { useFeaturedCases } from "../../content/hooks";
import CardSlider from "../../components/CardSlider/CardSlider";

import "./Cases.sass";

function Cases() {
  const { t } = useLanguage();
  const homeCases = useFeaturedCases(3);

  return (
    <section className="cases" id="cases">
      <div className="cases__container">
        <Badge className="cases__badge">{t("casesSection.badge")}</Badge>

        <div className="cases__heading">
          <h2 className="cases__title">
            {t("casesSection.titleStart")}
            <span>{t("casesSection.titleAccent")}</span>
          </h2>

          <Button
            className="cases__all"
            href="/cases"
            variant="outline"
            size="small"
            arrow
          >
            {t("casesSection.viewAll")}
          </Button>
        </div>

        <CardSlider trackClassName="cases__list">
          {homeCases.map((caseItem) => (
            <CaseCard key={caseItem.id} {...caseItem} />
          ))}
        </CardSlider>
      </div>
    </section>
  );
}

export default Cases;
