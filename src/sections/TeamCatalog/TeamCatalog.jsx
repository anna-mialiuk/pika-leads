import TeamCard from "../../components/TeamCard/TeamCard";
import { useLanguage, useData } from "../../i18n";

import "./TeamCatalog.sass";

function TeamCatalog() {
  const { t } = useLanguage();
  const { team } = useData("teamData");

  return (
    <section className="team-catalog">
      <div className="team-catalog__container">
        <div className="team-catalog__heading">
          <h2 className="team-catalog__title">{t("teamPage.catalogTitle")}</h2>

          <div className="team-catalog__line" />
        </div>

        <p className="team-catalog__description">
          {t("teamPage.catalogDescription")}
        </p>

        <div className="team-catalog__list">
          {team.map((member) => (
            <TeamCard key={member.id} {...member} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default TeamCatalog;
