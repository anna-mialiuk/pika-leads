import CallbackForm from "./CallbackForm";
import { CloseIcon, PhoneIcon } from "./icons";

import { useLanguage } from "../../i18n";

/** Картка «Передзвонити вам?», яка з'являється через кілька секунд */
function CallbackPopup({ isSent, onSubmit, onClose }) {
  const { t } = useLanguage();

  return (
    <div
      className="callback-popup"
      role="dialog"
      aria-label={t("callback.title")}
    >
      <button
        className="callback-popup__close"
        type="button"
        onClick={onClose}
        aria-label={t("consultation.close")}
      >
        <CloseIcon />
      </button>

      <div className="callback-popup__head">
        <span className="callback-popup__icon">
          <PhoneIcon />
        </span>

        <div>
          <strong className="callback-popup__title">
            {isSent ? t("callback.sentTitle") : t("callback.title")}
          </strong>
          <p className="callback-popup__text">
            {isSent ? t("callback.sentText") : t("callback.text")}
          </p>
        </div>
      </div>

      {!isSent && (
        <>
          <CallbackForm submitText={t("callback.submit")} onSubmit={onSubmit} />
          <p className="callback-popup__note">{t("callback.note")}</p>
        </>
      )}
    </div>
  );
}

export default CallbackPopup;
