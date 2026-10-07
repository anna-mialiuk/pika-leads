import Layout from "../../components/Layout/Layout";
import { Seo, useLanguage } from "../../i18n";

import ContactsSection from "../../sections/ContactsSection/ContactsSection";
import ContactsMap from "../../sections/ContactsMap/ContactsMap";

import "./Contacts.sass";

function Contacts() {
  const { t } = useLanguage();

  return (
    <Layout className="contacts-page">
      <Seo
        title={t("seo.contacts.title")}
        description={t("seo.contacts.description")}
      />

      <ContactsSection />
      <ContactsMap />
    </Layout>
  );
}

export default Contacts;
