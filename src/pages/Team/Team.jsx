import Layout from "../../components/Layout/Layout";
import { Seo, useLanguage } from "../../i18n";

import TeamHero from "../../sections/TeamHero/TeamHero";
import TeamCatalog from "../../sections/TeamCatalog/TeamCatalog";

import "./Team.sass";

function Team() {
  const { t } = useLanguage();

  return (
    <Layout className="team-page">
      <Seo
        title={t("seo.team.title")}
        description={t("seo.team.description")}
      />

      <TeamHero />
      <TeamCatalog />
    </Layout>
  );
}

export default Team;
