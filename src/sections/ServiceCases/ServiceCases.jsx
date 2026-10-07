import Badge from "../../components/Badge/Badge";
import Button from "../../components/Button/Button";
import ServiceCaseCard from "./ServiceCaseCard";

import { useLanguage, useData } from "../../i18n";
import { useCases } from "../../content/hooks";

import "./ServiceCases.sass";

function ServiceCases({ data }) {
  const { t } = useLanguage();
  const cases = useCases();
  const { caseSources, previewCases, previewSources } =
    useData("serviceCasesData");

  if (!data) return null;

  const source = data.source || "meta";
  const sourceInfo = caseSources[source] || caseSources.meta;
  const isPreview = previewSources.includes(source);

  const items =
    previewCases[source] ||
    cases.filter((item) => item.source === source).slice(0, 3);

  const sectionClasses = [
    "service-cases",
    isPreview && `service-cases--preview service-cases--${source}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClasses}>
      <div className="service-cases__container">
        <Badge className="service-cases__badge" variant="service">
          {data.badge || t("serviceCases.badge")}
        </Badge>

        <h2 className="service-cases__title">
          {data.title || t("serviceCases.title")}{" "}
          <span>{data.accent || sourceInfo.name}</span>
        </h2>

        <div className="service-cases__list">
          {items.map((item) => (
            <ServiceCaseCard
              key={item.id}
              item={item}
              sourceLabel={sourceInfo.label}
              isPreview={isPreview}
            />
          ))}
        </div>

        {data.showButton !== false && (
          <div className="service-cases__footer">
            <Button
              className="service-cases__all"
              href={`/cases?source=${source}`}
              variant="outline"
              arrow
            >
              {data.buttonText || sourceInfo.buttonText}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default ServiceCases;
