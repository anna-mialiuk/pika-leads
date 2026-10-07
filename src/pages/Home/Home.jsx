import Layout from "../../components/Layout/Layout";
import { Seo, useLanguage } from "../../i18n";

import Hero from "../../sections/Hero/Hero";
import WhyUs from "../../sections/WhyUs/WhyUs";
import Advantages from "../../sections/Advantages/Advantages";
import Audit from "../../sections/Audit/Audit";
import Cases from "../../sections/Cases/Cases";
import Services from "../../sections/Services/Services";
import Conferences from "../../sections/Conferences/Conferences";
import Blog from "../../sections/Blog/Blog";
import About from "../../sections/About/About";
import Principles from "../../sections/Principles/Principles";
import Team from "../../sections/Team/Team";
import Testimonials from "../../sections/Testimonials/Testimonials";
import Faq from "../../sections/Faq/Faq";

function Home() {
  const { t } = useLanguage();

  return (
    <Layout className="home">
      <Seo
        title={t("seo.home.title")}
        description={t("seo.home.description")}
      />

      <Hero />
      <WhyUs />
      <Advantages />
      <Audit />
      <Cases />
      <Services />
      <Conferences />
      <Blog />
      <About />
      <Principles />
      <Team />
      <Testimonials />
      <Faq />
    </Layout>
  );
}

export default Home;
