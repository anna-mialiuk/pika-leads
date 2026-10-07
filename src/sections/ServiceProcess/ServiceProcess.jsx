import Badge from "../../components/Badge/Badge";

import "./ServiceProcess.sass";

// Ширина колонки кроку зростає на 3rem з кожним кроком (сходинки)
const STEP_BASE_WIDTH = 12.8;
const STEP_INCREMENT = 3;

function ServiceProcess({ data, theme }) {
  if (!data) return null;

  const {
    badge,
    titleBefore,
    titleAccent,
    description,
    startLabel,
    items = [],
    resultTitle,
    resultDescription,
  } = data;

  const processColors = theme?.processColors || [];

  return (
    <section className="service-process">
      <div className="service-process__container">
        <Badge className="service-process__badge" variant="service">
          {badge}
        </Badge>

        <h2 className="service-process__title">
          {titleBefore} <span>{titleAccent}</span>
        </h2>

        <p className="service-process__description">{description}</p>

        <div className="service-process__start">
          <div className="service-process__start-label">
            <span className="service-process__start-dot" />
            {startLabel}
          </div>

          <div className="service-process__start-line" />
        </div>

        <div className="service-process__steps">
          {items.map((step, index) => (
            <div
              className="service-process__step"
              style={{
                "--process-step-color":
                  processColors[index] || theme?.accent || "#0866FF",
                "--process-step-width": `${STEP_BASE_WIDTH + index * STEP_INCREMENT}rem`,
              }}
              key={step.number}
            >
              <div className="service-process__step-side">
                <span className="service-process__step-bg-number">
                  {step.number}
                </span>

                <strong className="service-process__step-number">
                  {step.number}
                </strong>

                <span className="service-process__step-label">
                  {step.label}
                </span>
              </div>

              <span className="service-process__step-node" />

              <div className="service-process__step-content">
                <h3 className="service-process__step-title">{step.title}</h3>

                <p className="service-process__step-description">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="service-process__result">
          <div className="service-process__result-icon">
            <span className="service-process__result-circle" />
          </div>

          <div>
            <h3 className="service-process__result-title">{resultTitle}</h3>

            <p className="service-process__result-description">
              {resultDescription}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ServiceProcess;
