import { useLanguage } from "../i18n/LanguageContext.js";

interface VideoPlayerProps {
  url: string;
  title?: string;
}

/**
 * HTML5動画プレーヤーコンポーネント。
 */
export function VideoPlayer({ url, title }: VideoPlayerProps) {
  const { t } = useLanguage();

  if (!url) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: "1rem",
        borderRadius: "8px",
        overflow: "hidden",
        background: "#000",
      }}
    >
      {title && <h3 style={{ padding: "0.5rem 1rem", color: "#fff" }}>{title}</h3>}
      <video
        controls
        style={{ width: "100%", maxHeight: "480px" }}
        src={url}
      >
        {t("video.unsupported")}
      </video>
    </div>
  );
}
