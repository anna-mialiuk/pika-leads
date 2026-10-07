import "./FaqItem.sass";

function FaqItem({ number, question, answer, isOpen, onToggle }) {
  return (
    <div className={`faq-item ${isOpen ? "faq-item--open" : ""}`}>
      <button
        className="faq-item__header"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="faq-item__number">
          {String(number).padStart(2, "0")}
        </span>

        <span className="faq-item__question">{question}</span>

        <span className="faq-item__toggle">
          <span />
          <span />
        </span>
      </button>

      <div className="faq-item__answer-wrap">
        <div className="faq-item__answer">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

export default FaqItem;
