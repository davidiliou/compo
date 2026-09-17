import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Player } from "../types";
import { POSITION_LABELS } from "../types";

const empty = {
  number: 0,
  first_name: "",
  last_name: "",
  license_number: "",
  positions: [] as number[],
};

function formatPositions(positions: number[]): string {
  if (!positions?.length) return "—";
  return positions.map((p) => `${p}`).join(", ");
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(empty);
  const [positionsText, setPositionsText] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      setPlayers(await api.getPlayers());
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const parsePositionsInput = (raw: string): number[] => {
    const parts = raw.split(/[,;/|]+/).map((s) => s.trim()).filter(Boolean);
    const out: number[] = [];
    for (const part of parts) {
      const n = Number(part);
      if (Number.isInteger(n) && n >= 1 && n <= 15 && !out.includes(n)) out.push(n);
    }
    return out;
  };

  const reset = () => {
    setForm(empty);
    setPositionsText("");
    setEditingId(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      positions: parsePositionsInput(positionsText),
    };
    try {
      if (editingId) {
        await api.updatePlayer(editingId, payload);
      } else {
        await api.createPlayer(payload);
      }
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const onEdit = (p: Player) => {
    setEditingId(p.id);
    setForm({
      number: p.number,
      first_name: p.first_name,
      last_name: p.last_name || "",
      license_number: p.license_number,
      positions: p.positions || [],
    });
    setPositionsText((p.positions || []).join(", "));
  };

  const onDelete = async (id: number) => {
    if (!confirm("Supprimer ce joueur ?")) return;
    try {
      await api.deletePlayer(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const onImportFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    setInfo("");
    try {
      const result = await api.importPlayers(file);
      setInfo(
        `Import terminé : ${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} ignoré(s).`,
      );
      if (result.errors?.length) {
        setError(result.errors.slice(0, 5).join(" · "));
      } else {
        setError("");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur d’import");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div>
      <h1 className="page-title">Joueurs</h1>
      <p className="page-sub">
        Effectif : n°, nom, prénom, postes (1–15) et licence. Import Excel possible.
      </p>

      {error && <div className="error">{error}</div>}
      {info && <div className="success">{info}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xlsm"
            hidden
            onChange={(e) => onImportFile(e.target.files?.[0])}
          />
          <button
            className="btn btn-accent"
            type="button"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {importing ? "Import…" : "Importer Excel"}
          </button>
          <a
            className="btn btn-ghost"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              api.downloadPlayersTemplate().catch((err) =>
                setError(err instanceof Error ? err.message : "Erreur modèle"),
              );
            }}
          >
            Télécharger le modèle
          </a>
          <span style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
            Colonnes : Nom, Prénom, Postes, Numéro de licence
          </span>
        </div>

        <form className="toolbar" onSubmit={onSubmit}>
          <div className="field" style={{ flex: "0 0 80px" }}>
            <label htmlFor="number">N°</label>
            <input
              id="number"
              type="number"
              min={0}
              max={99}
              value={form.number}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
            />
          </div>
          <div className="field">
            <label htmlFor="last_name">Nom</label>
            <input
              id="last_name"
              required
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="first_name">Prénom</label>
            <input
              id="first_name"
              required
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="positions">Postes (ex: 1, 3)</label>
            <input
              id="positions"
              placeholder="1, 3, 8"
              value={positionsText}
              onChange={(e) => setPositionsText(e.target.value)}
              title={Object.entries(POSITION_LABELS)
                .filter(([k]) => Number(k) <= 15)
                .map(([k, v]) => `${k}=${v}`)
                .join(" · ")}
            />
          </div>
          <div className="field">
            <label htmlFor="license">N° licence</label>
            <input
              id="license"
              required
              value={form.license_number}
              onChange={(e) => setForm({ ...form, license_number: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" type="submit">
            {editingId ? "Enregistrer" : "Ajouter"}
          </button>
          {editingId && (
            <button className="btn btn-ghost" type="button" onClick={reset}>
              Annuler
            </button>
          )}
        </form>
      </div>

      <div className="panel">
        {loading ? (
          <p className="empty">Chargement…</p>
        ) : players.length === 0 ? (
          <p className="empty">Aucun joueur pour le moment.</p>
        ) : (
          <>
            <div className="table-desktop">
              <table className="table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Nom</th>
                    <th>Prénom</th>
                    <th>Postes</th>
                    <th>Licence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.number || "—"}</strong>
                      </td>
                      <td>{p.last_name || "—"}</td>
                      <td>{p.first_name}</td>
                      <td>{formatPositions(p.positions || [])}</td>
                      <td>{p.license_number}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => onEdit(p)}
                          >
                            Modifier
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onDelete(p.id)}
                          >
                            Supprimer
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-list">
              {players.map((p) => (
                <article key={p.id} className="data-card">
                  <div className="data-card-head">
                    <strong>
                      {p.number ? `#${p.number} ` : ""}
                      {p.first_name} {p.last_name}
                    </strong>
                  </div>
                  <p className="data-card-meta">
                    Postes : {formatPositions(p.positions || [])} · Licence{" "}
                    {p.license_number}
                  </p>
                  <div className="row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(p)}>
                      Modifier
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onDelete(p.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
