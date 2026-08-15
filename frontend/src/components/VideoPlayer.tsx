interface VideoPlayerProps {
  url: string;
  title?: string;
}

/**
 * HTML5 video player component.
 */
export function VideoPlayer({ url, title }: VideoPlayerProps) {
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
        Your browser does not support the video tag.
      </video>
    </div>
  );
}
