import ConferenceCard from "../../components/ConferenceCard/ConferenceCard";
import { useLanguage, useData } from "../../i18n";
import Badge from "../../components/Badge/Badge";

import "./Conferences.sass";

function Conferences() {
  const { t } = useLanguage();
  const { conferences } = useData("conferenceData");

  return (
    <section className="conferences">
      <div className="conferences__container">
        <Badge className="conferences__label">{t("conferences.badge")}</Badge>

        <h2 className="conferences__title">
          {t("conferences.titleStart")}
          <span>{t("conferences.titleAccent")}</span>
        </h2>

        <p className="conferences__description">
          {t("conferences.description")}
        </p>

        <div className="conferences__list">
          {conferences.map((conference) => (
            <ConferenceCard key={conference.id} {...conference} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Conferences;
