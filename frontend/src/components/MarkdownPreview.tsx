interface MarkdownPreviewProps {
  content: string;
}

/**
 * Simple Marp markdown preview component.
 * Renders markdown content as preformatted text.
 * In production, this could use a Marp renderer for full slide preview.
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content) {
    return <p>No content available</p>;
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
