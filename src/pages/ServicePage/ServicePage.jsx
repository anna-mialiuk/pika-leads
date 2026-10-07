import { useParams } from "react-router-dom";

import Layout from "../../components/Layout/Layout";

import ServiceHero from "../../sections/ServiceHero/ServiceHero";
import ServiceScope from "../../sections/ServiceScope/ServiceScope";
import ServiceGuarantees from "../../sections/ServiceGuarantees/ServiceGuarantees";
import ServiceSupport from "../../sections/ServiceSupport/ServiceSupport";
import ServiceCases from "../../sections/ServiceCases/ServiceCases";
import ServiceAudit from "../../sections/ServiceAudit/ServiceAudit";
import ServiceProcess from "../../sections/ServiceProcess/ServiceProcess";
import ServiceClients from "../../sections/ServiceClients/ServiceClients";
import ServiceTestimonials from "../../sections/ServiceTestimonials/ServiceTestimonials";
import ServiceWheel from "../../sections/ServiceWheel/ServiceWheel";
import ServiceSingle from "../../sections/ServiceSingle/ServiceSingle";
import Faq from "../../sections/Faq/Faq";

import { serviceThemes, getServiceThemeStyles } from "../../data/serviceThemes";
import { LocalizedNavigate, Seo, useData } from "../../i18n";

import "./ServicePage.sass";

function ServicePage() {
  const { slug } = useParams();

  const { services } = useData("servicesData");
  const { servicePages } = useData("servicePagesData");
  const { faqItems, faqItemsByTheme } = useData("faqData");
  const { faqDescriptionsByTheme, defaultFaqDescription } = useData(
    "faqDescriptionsData",
  );

  const service = services.find((item) => item.slug === slug);
  const pageData = servicePages[slug];

  if (!service || !pageData) {
    return <LocalizedNavigate to="/" replace />;
  }

  const themeName = pageData.theme || "meta";
  const theme = serviceThemes[themeName] || serviceThemes.meta;

  const seo = (
    <Seo
      title={service.title}
      description={
        pageData.hero?.description ||
        pageData.single?.description ||
        service.text
      }
    />
  );

  const layoutProps = {
    className: `service-page service-page--${themeName}`,
    style: getServiceThemeStyles(theme),
  };

  // Односторінкова послуга (software-development)
  if (pageData.layout === "single") {
    return (
      <Layout {...layoutProps}>
        {seo}
        <ServiceSingle data={pageData.single} />
      </Layout>
    );
  }

  return (
    <Layout {...layoutProps}>
      {seo}
      <ServiceHero data={pageData.hero} type={themeName} />
      <ServiceScope data={pageData.scope} />
      <ServiceGuarantees data={pageData.guarantees} />
      <ServiceSupport data={pageData.support} />
      <ServiceCases data={pageData.cases} />
      <ServiceAudit data={pageData.audit} />
      <ServiceProcess data={pageData.process} theme={theme} />
      <ServiceClients />
      <ServiceTestimonials />
      <Faq
        items={faqItemsByTheme[themeName] || faqItems}
        description={faqDescriptionsByTheme[themeName] || defaultFaqDescription}
      />
      <ServiceWheel />
    </Layout>
  );
}

export default ServicePage;
