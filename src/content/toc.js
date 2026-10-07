import { toPlainText } from "./inline";

/** Зміст статті будується автоматично із заголовків H2 з id */
export const getToc = (blocks = []) =>
  blocks
    .filter(
      (block) => block.type === "heading" && block.level === 2 && block.id,
    )
    .map((block) => ({ id: block.id, title: toPlainText(block.text) }));
