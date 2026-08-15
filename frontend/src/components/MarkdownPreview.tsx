import { useLanguage } from "../i18n/LanguageContext.js";

interface MarkdownPreviewProps {
  content: string;
}

/**
 * Marp Markdownを整形済みテキストとして表示する簡易プレビュー。
 * 本番環境ではMarpレンダラーによるスライドプレビューへ置き換えられる。
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const { t } = useLanguage();

  if (!content) {
    return <p>{t("markdown.empty")}</p>;
  }

  return (
    <div
      style={{
        background: "#f5f5f5",
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "1rem",
        overflow: "auto",
        maxHeight: "600px",
      }}
    >
      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
        {content}
      </pre>
    </div>
  );
}
