import { useLanguage } from "../../i18n";

import "./ConferenceCard.sass";

function ConferenceCard({
  image,
  title,
  description,
  event,
  videoUrl,
  summaryUrl,
}) {
  const { t } = useLanguage();

  const hasVideo = Boolean(videoUrl);
  const hasSummary = Boolean(summaryUrl);

  const mediaContent = (
    <>
      {image ? (
        <img
          className="conference-card__image"
          src={image}
          alt={title}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="conference-card__placeholder">
          {t("conferences.videoPreview")}
        </span>
      )}

      {hasVideo && (
        <span className="conference-card__play">
          <span />
        </span>
      )}
    </>
  );

  return (
    <article className="conference-card">
      {hasVideo ? (
        <a
          className="conference-card__media conference-card__media--clickable"
          href={videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("conferences.watchVideo", { title })}
        >
          {mediaContent}
        </a>
      ) : (
        <div className="conference-card__media">{mediaContent}</div>
      )}

      <div className="conference-card__content">
        <h3 className="conference-card__title">{title}</h3>

        <p className="conference-card__description">{description}</p>

        <div className="conference-card__event">
          <span>{event}</span>
        </div>

        {hasSummary && (
          <a className="conference-card__link" href={summaryUrl}>
            {t("conferences.readSummary")}
            <span>→</span>
          </a>
        )}
      </div>
    </article>
  );
}

export default ConferenceCard;
