import { DEFAULT_LANGUAGE, useLanguage } from "../../i18n";

import "./CaseTranslationNote.sass";

/** Плашка «детальний опис поки українською» для неперекладених кейсів */
function CaseTranslationNote({ caseItem }) {
  const { lang, t } = useLanguage();

  if (lang === DEFAULT_LANGUAGE || caseItem?.fullyTranslated) return null;

  return (
    <section className="case-translation-note">
      <div className="case-translation-note__container">
        <p className="case-translation-note__text">
          <span className="case-translation-note__icon" aria-hidden="true">
            i
          </span>
          {t("casePage.untranslated")}
        </p>
      </div>
    </section>
  );
}

export default CaseTranslationNote;
