import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/LoginForm";
import { Dashboard } from "./pages/Dashboard";

export function App() {
  const auth = useAuth();

  if (auth.isLoading) {
    return (
      <div className="loading">
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <LoginForm
        onSignIn={auth.signIn}
        onSignUp={auth.signUp}
        onConfirm={auth.confirmSignUp}
        error={auth.error}
      />
    );
  }

  return (
    <Dashboard
      idToken={auth.idToken!}
      email={auth.email!}
      onSignOut={auth.signOut}
    />
  );
}
