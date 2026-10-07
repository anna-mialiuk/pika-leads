import { useState } from "react";

import { useLanguage } from "../../i18n";

import "./TestimonialCard.sass";

function TestimonialCard({
  initials,
  name,
  category,
  meta,
  badge,
  text,
  expandable = false,
  featured = false,
}) {
  const { t } = useLanguage();

  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <article
      className={`testimonial-card ${
        featured ? "testimonial-card--featured" : ""
      }`}
    >
      <span className="testimonial-card__quote">“</span>

      <div className="testimonial-card__rating">★ ★ ★ ★ ★</div>

      <div className="testimonial-card__badge">{badge}</div>

      <div className="testimonial-card__body">
        <p
          className={`testimonial-card__text ${
            isExpanded ? "testimonial-card__text--expanded" : ""
          }`}
        >
          {text}
        </p>

        {expandable && (
          <button
            className="testimonial-card__more"
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
          >
            {isExpanded
              ? t("testimonials.collapse")
              : t("testimonials.readFull")}
            <span>{isExpanded ? "↑" : "›"}</span>
          </button>
        )}
      </div>

      <div className="testimonial-card__author">
        <div className="testimonial-card__avatar">{initials}</div>

        <div className="testimonial-card__author-info">
          <strong>{name}</strong>

          <span>
            {category}
            {meta && <> · {meta}</>}
          </span>
        </div>
      </div>
    </article>
  );
}

export default TestimonialCard;
