import { useState } from "react";
import { useParams } from "react-router-dom";

import Header from "../../sections/Header/Header";
import Footer from "../../components/Footer/Footer";
import CaseGallery from "../../components/CaseGallery/CaseGallery";

import CaseHero from "../../sections/CaseHero/CaseHero";
import CaseTranslationNote from "../../sections/CaseTranslationNote/CaseTranslationNote";
import CaseResults from "../../sections/CaseResults/CaseResults";
import CaseContext from "../../sections/CaseContext/CaseContext";
import CaseStrategy from "../../sections/CaseStrategy/CaseStrategy";
import CaseVideoReview from "../../sections/CaseVideoReview/CaseVideoReview";
import CaseEvidence from "../../sections/CaseEvidence/CaseEvidence";
import CaseCTA from "../../sections/CaseCTA/CaseCTA";
import CaseRelated from "../../sections/CaseRelated/CaseRelated";

import { LocalizedNavigate, Seo, useLanguage } from "../../i18n";
import { useCases } from "../../content/hooks";

function CasePage() {
  const { slug } = useParams();

  const [galleryIndex, setGalleryIndex] = useState(null);

  const cases = useCases();
  const { t } = useLanguage();

  const caseItem = cases.find((item) => item.id === slug);

  if (!caseItem) {
    return <LocalizedNavigate to="/cases" replace />;
  }

  const contextScreenshots = caseItem.context?.screenshots || [];
  const historyScreenshots = caseItem.history?.screenshots || [];

  const architectureScreenshots =
    caseItem.strategy?.architectureScreenshots || [];

  const creativeScreenshots = caseItem.strategy?.creativeScreenshots || [];

  const optimizationScreenshots =
    caseItem.strategy?.optimizationScreenshots || [];

  const strategyScreenshots = [
    ...architectureScreenshots,
    ...creativeScreenshots,
    ...optimizationScreenshots,
  ];

  const evidenceScreenshots = caseItem.evidence?.screenshots || [];

  const allScreenshots = [
    ...contextScreenshots,
    ...historyScreenshots,
    ...strategyScreenshots,
    ...evidenceScreenshots,
  ];

  const contextOffset = 0;

  const historyOffset = contextOffset + contextScreenshots.length;

  const strategyOffset = historyOffset + historyScreenshots.length;

  const evidenceOffset = strategyOffset + strategyScreenshots.length;

  const evidenceGalleryIndexes = evidenceScreenshots.map(
    (_, index) => evidenceOffset + index,
  );

  const closeGallery = () => {
    setGalleryIndex(null);
  };

  return (
    <>
      <Seo
        title={`${caseItem.title} — ${t("seo.caseSuffix")}`}
        description={caseItem.description}
        image={caseItem.image}
        type="article"
      />

      <Header />

      <main>
        <CaseHero caseItem={caseItem} />

        <CaseTranslationNote caseItem={caseItem} />

        {caseItem.results && <CaseResults results={caseItem.results} />}

        {caseItem.context && (
          <CaseContext
            context={caseItem.context}
            onImageClick={setGalleryIndex}
            galleryOffset={contextOffset}
          />
        )}

        {caseItem.history && (
          <CaseContext
            context={caseItem.history}
            onImageClick={setGalleryIndex}
            galleryOffset={historyOffset}
          />
        )}

        {caseItem.strategy && (
          <CaseStrategy
            strategy={caseItem.strategy}
            onImageClick={setGalleryIndex}
            galleryOffset={strategyOffset}
          />
        )}

        {caseItem.videoReview && (
          <CaseVideoReview videoReview={caseItem.videoReview} />
        )}

        {caseItem.evidence && (
          <CaseEvidence
            evidence={caseItem.evidence}
            onImageClick={setGalleryIndex}
            galleryIndexes={evidenceGalleryIndexes}
          />
        )}

        {caseItem.cta && <CaseCTA cta={caseItem.cta} />}

        <CaseRelated currentCase={caseItem} cases={cases} />
      </main>

      <Footer />

      {galleryIndex !== null && allScreenshots.length > 0 && (
        <CaseGallery
          images={allScreenshots}
          initialIndex={galleryIndex}
          title={caseItem.title}
          onClose={closeGallery}
        />
      )}
    </>
  );
}

export default CasePage;
