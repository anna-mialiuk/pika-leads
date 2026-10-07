import "./ArticleNote.sass";

function ArticleNote({ children, variant = "default" }) {
  return (
    <div
      className={`article-note ${
        variant === "warning" ? "article-note--warning" : ""
      }`}
    >
      <span className="article-note__icon">
        {variant === "warning" ? "!" : "i"}
      </span>

      <div className="article-note__text">{children}</div>
    </div>
  );
}

export default ArticleNote;
