import { FormEvent, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

export default function LoginPage() {
  const { username, loading, login } = useAuth();
  const location = useLocation();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && username) {
    const redirect = (location.state as { from?: string } | null)?.from || "/admin";
    return <Navigate to={redirect} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(user.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card panel" onSubmit={onSubmit}>
        <img className="login-logo" src="/logo.png" alt="Costières XV" width={120} height={120} />
        <p className="login-brand">Compo Rugby</p>
        <h1>Connexion</h1>
        <p className="page-sub" style={{ marginBottom: "1.25rem" }}>
          Espace staff / admin
        </p>
        {error && <div className="error">{error}</div>}
        <div className="field" style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="username">Utilisateur</label>
          <input
            id="username"
            autoComplete="username"
            required
            value={user}
            onChange={(e) => setUser(e.target.value)}
          />
        </div>
        <div className="field" style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
