import { useEffect, useRef, useState } from "react";
import { api } from "../api";

export default function SettingsPage() {
  const [info, setInfo] = useState<{
    players: number;
    matches: number;
    compositions: number;
    slots: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshInfo = async () => {
    setInfo(await api.getSettingsInfo());
  };

  useEffect(() => {
    (async () => {
      try {
        await refreshInfo();
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      }
    })();
  }, []);

  const onBackup = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api.downloadBackup();
      setMessage("Sauvegarde téléchargée.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde");
    } finally {
      setBusy(false);
    }
  };

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    if (
      !confirm(
        "Cette opération remplace TOUTES les données actuelles (joueurs, matchs, compositions). Continuer ?",
      )
    ) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.restoreBackup(file);
      setMessage(
        `Import OK : ${result.players} joueur(s), ${result.matches} match(s), ${result.compositions} composition(s), ${result.slots} placement(s).`,
      );
      await refreshInfo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur lors de l’import");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <h1 className="page-title">Paramètres</h1>
      <p className="page-sub">Sauvegarde et restauration des données.</p>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2
          style={{
            marginTop: 0,
            fontFamily: "var(--font-display)",
            color: "var(--green-deep)",
          }}
        >
          Sauvegarde / restauration
        </h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Exportez ou réimportez un fichier JSON (joueurs, matchs, compositions,
          placements). L’import remplace entièrement les données actuelles.
        </p>
        <div className="row-actions">
          <button
            type="button"
            className="btn btn-accent"
            disabled={busy}
            onClick={onBackup}
          >
            {busy ? "Traitement…" : "Télécharger une sauvegarde"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => onRestoreFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Importer une sauvegarde
          </button>
        </div>
      </div>

      <div className="panel">
        <h2
          style={{
            marginTop: 0,
            fontFamily: "var(--font-display)",
            color: "var(--green-deep)",
          }}
        >
          Contenu actuel
        </h2>
        {!info ? (
          <p className="empty">Chargement…</p>
        ) : (
          <table className="table">
            <tbody>
              <tr>
                <th>Joueurs</th>
                <td>{info.players}</td>
              </tr>
              <tr>
                <th>Matchs</th>
                <td>{info.matches}</td>
              </tr>
              <tr>
                <th>Compositions</th>
                <td>{info.compositions}</td>
              </tr>
              <tr>
                <th>Placements (slots)</th>
                <td>{info.slots}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
