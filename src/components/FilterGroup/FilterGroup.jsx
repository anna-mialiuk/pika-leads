import "./FilterGroup.sass";

/**
 * Група кнопок-фільтрів із лічильниками.
 * items: [{ id, label, color? }] — якщо є color, кнопка фарбується у нього.
 */
function FilterGroup({ label, items, active, counts = {}, onChange }) {
  return (
    <div className="filter-group">
      <span className="filter-group__label">{label}</span>

      <div className="filter-group__list">
        {items.map((item) => {
          const count = counts[item.id] ?? 0;
          const isActive = active === item.id;
          const isDisabled = item.id !== "all" && count === 0;

          const classes = [
            "filter-group__button",
            item.color && "filter-group__button--colored",
            isActive && "filter-group__button--active",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              className={classes}
              type="button"
              key={item.id}
              disabled={isDisabled}
              style={item.color ? { "--filter-color": item.color } : undefined}
              onClick={() => onChange(item.id)}
            >
              {item.color && <span className="filter-group__dot" />}
              <span>{item.label}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FilterGroup;
