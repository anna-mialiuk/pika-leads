import { useCountdown } from "../../hooks/useCountdown";
import { useLanguage } from "../../i18n";

import "./CountdownTimer.sass";

const TIMER_DURATION = 5 * 60 * 1000;

const units = ["minutes", "seconds", "centiseconds"];

function CountdownTimer() {
  const time = useCountdown(TIMER_DURATION);
  const { t } = useLanguage();

  return (
    <div className="countdown-timer">
      <div className="countdown-timer__label">
        <span className="countdown-timer__dot" />
        <span>{t("countdown.label")}</span>
      </div>

      <div className="countdown-timer__time">
        {units.map((key, index) => (
          <div className="countdown-timer__item" key={key}>
            {index > 0 && <span className="countdown-timer__separator">:</span>}

            <div className="countdown-timer__unit">
              <strong>{time[key]}</strong>
              <span>{t(`countdown.${key}`)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CountdownTimer;
