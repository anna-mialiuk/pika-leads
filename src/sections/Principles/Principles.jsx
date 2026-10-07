import PrincipleCard from "../../components/PrincipleCard/PrincipleCard";
import { useLanguage, useData } from "../../i18n";
import Badge from "../../components/Badge/Badge";

import "./Principles.sass";

function Principles() {
  const { t } = useLanguage();
  const { principles } = useData("principlesData");

  return (
    <section className="principles">
      <div className="principles__container">
        <Badge className="principles__label">{t("principles.badge")}</Badge>

        <h2 className="principles__title">
          {t("principles.titleStart")}
          <span>{t("principles.titleAccent")}</span>
        </h2>

        <div className="principles__list">
          {principles.map((principle) => (
            <PrincipleCard key={principle.id} {...principle} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Principles;
