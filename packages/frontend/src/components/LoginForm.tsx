import { useState } from "react";

interface LoginFormProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onConfirm: (email: string, code: string) => Promise<void>;
  error: string | null;
}

export function LoginForm({ onSignIn, onSignUp, onConfirm, error }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "confirm">("signin");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        await onSignUp(email, password);
        setMode("confirm");
      } else if (mode === "confirm") {
        await onConfirm(email, code);
        setMode("signin");
      } else {
        await onSignIn(email, password);
      }
    } catch {
      // エラーは親から error prop で表示される
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h1>Slide-First AI Video</h1>
      <p className="subtitle">スライドから動画を自動生成</p>
      <form onSubmit={handleSubmit} className="login-form">
        {mode === "confirm" ? (
          <>
            <p>確認コードがメールに送信されました。</p>
            <input
              type="text"
              placeholder="確認コード（6桁）"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </>
        ) : (
          <>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="パスワード（8文字以上、大文字/小文字/数字）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading
            ? "処理中..."
            : mode === "signup"
              ? "サインアップ"
              : mode === "confirm"
                ? "確認"
                : "サインイン"}
        </button>
        {mode === "signin" && (
          <p className="switch-mode">
            アカウントがない場合は
            <button type="button" onClick={() => setMode("signup")}>
              サインアップ
            </button>
          </p>
        )}
        {mode === "signup" && (
          <p className="switch-mode">
            アカウントをお持ちの場合は
            <button type="button" onClick={() => setMode("signin")}>
              サインイン
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
