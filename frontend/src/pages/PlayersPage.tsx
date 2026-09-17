import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { Player } from "../types";

const empty = { number: 0, first_name: "", license_number: "" };

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  const reset = () => {
    setForm(empty);
    setEditingId(null);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updatePlayer(editingId, form);
      } else {
        await api.createPlayer(form);
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
      license_number: p.license_number,
    });
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

  return (
    <div>
      <h1 className="page-title">Joueurs</h1>
      <p className="page-sub">Gérez l’effectif : n°, prénom et licence.</p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <form className="toolbar" onSubmit={onSubmit}>
          <div className="field" style={{ flex: "0 0 90px" }}>
            <label htmlFor="number">N°</label>
            <input
              id="number"
              type="number"
              min={0}
              max={99}
              required
              value={form.number}
              onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
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
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Prénom</th>
                <th>Licence</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.number}</strong>
                  </td>
                  <td>{p.first_name}</td>
                  <td>{p.license_number}</td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
