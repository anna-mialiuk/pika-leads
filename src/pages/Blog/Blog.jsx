import Layout from "../../components/Layout/Layout";
import { Seo, useLanguage } from "../../i18n";

import BlogHero from "../../sections/BlogHero/BlogHero";
import BlogCatalog from "../../sections/BlogCatalog/BlogCatalog";

function Blog() {
  const { t } = useLanguage();

  return (
    <Layout className="blog-page">
      <Seo
        title={t("seo.blog.title")}
        description={t("seo.blog.description")}
      />

      <BlogHero />
      <BlogCatalog />
    </Layout>
  );
}

export default Blog;
