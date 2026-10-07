import { useLanguage } from "../../i18n";

import "./CaseVideoReview.sass";

function CaseVideoReview({ videoReview }) {
  const { t } = useLanguage();

  if (!videoReview?.url) return null;

  const {
    title = t("casePage.videoTitle"),
    url,
    label = t("casePage.videoLabel"),
    eyebrow = "PIKA LEADS",
    name = "",
    metric = "",
    caption = "",
    visual = "default",
  } = videoReview;

  return (
    <section className="case-video-review">
      <div className="case-video-review__container">
        <h2 className="case-video-review__title">{title}</h2>

        <a
          className={`case-video-review__card case-video-review__card--${visual}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
        >
          <div className="case-video-review__content">
            <div className="case-video-review__eyebrow">
              {eyebrow} <span>•</span> {t("casePage.videoCase")}
            </div>

            <div className="case-video-review__visual">
              <div className="case-video-review__text">
                <span className="case-video-review__line" />

                {name && (
                  <strong className="case-video-review__name">{name}</strong>
                )}

                {metric && (
                  <span className="case-video-review__roas">{metric}</span>
                )}
              </div>

              {visual === "lighting" && (
                <div className="case-video-review__lights">
                  <span />
                  <span />
                  <span />
                </div>
              )}

              {visual === "furniture" && (
                <div className="case-video-review__furniture">
                  <span className="case-video-review__sofa" />
                  <span className="case-video-review__frame case-video-review__frame--1" />
                  <span className="case-video-review__frame case-video-review__frame--2" />
                  <span className="case-video-review__frame case-video-review__frame--3" />
                </div>
              )}
            </div>

            <div className="case-video-review__play">
              <span>▶</span>
            </div>

            {caption && (
              <div className="case-video-review__caption">{caption}</div>
            )}

            <div className="case-video-review__bottom">
              <span className="case-video-review__small-play">▶</span>
              <span>{t("casePage.videoBottom")}</span>
            </div>
          </div>
        </a>
      </div>
    </section>
  );
}

export default CaseVideoReview;
