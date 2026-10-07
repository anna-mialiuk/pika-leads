import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import TeamCard from "../../components/TeamCard/TeamCard";
import { useLanguage, useData } from "../../i18n";

import "./Team.sass";

/** Скільки людей показувати на головній (решта — на сторінці «Команда») */
const HOME_TEAM_LIMIT = 3;

function Team() {
  const { t } = useLanguage();
  const { team } = useData("teamData");

  return (
    <section className="team" id="team">
      <div className="team__container">
        <Badge className="team__label">{t("team.badge")}</Badge>

        <div className="team__heading">
          <h2 className="team__title">
            {t("team.titleLine1")}
            <span>
              {t("team.titleAccent")}
              <strong>{t("team.titleStrong")}</strong>
            </span>
          </h2>

          <Button
            className="team__all"
            href="/team"
            variant="outline"
            size="small"
            arrow
          >
            {t("team.allTeam")}
          </Button>
        </div>

        <div className="team__list">
          {team.slice(0, HOME_TEAM_LIMIT).map((member) => (
            <TeamCard key={member.id} {...member} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Team;
