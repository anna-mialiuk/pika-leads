import { useLanguage } from "../../i18n";

import "./LeadFormError.sass";

/** Повідомлення, якщо заявку не вдалося надіслати */
function LeadFormError() {
  const { t } = useLanguage();

  return (
    <p className="lead-form-error" role="alert">
      {t("leadForm.error")}
    </p>
  );
}

export default LeadFormError;
