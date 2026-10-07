import { useLanguage } from "../../i18n";

import "./FormSuccess.sass";

function FormSuccess() {
  const { t } = useLanguage();

  return (
    <div className="form-success">
      <h3 className="form-success__title">{t("formSuccess.title")}</h3>

      <p className="form-success__text">{t("formSuccess.text")}</p>
    </div>
  );
}

export default FormSuccess;
