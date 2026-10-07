import "./ArticleCodeBlock.sass";

function ArticleCodeBlock({ children }) {
  return (
    <pre className="article-code-block">
      <code>{children}</code>
    </pre>
  );
}

export default ArticleCodeBlock;
