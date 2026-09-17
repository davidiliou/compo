import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Match, TeamSize } from "../types";
import { MATCH_FORMATS, TEAM_SIZE_OPTIONS, getMatchFormat, normalizeTeamSize } from "../types";

const empty = {
  opponent: "",
  match_date: new Date().toISOString().slice(0, 10),
  venue: "Domicile",
  team_size: 15 as TeamSize,
  half_duration_minutes: 35,
  score_home: null as number | null,
  score_away: null as number | null,
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setMatches(await api.getMatches());
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
    if (editingId) {
      const current = matches.find((m) => m.id === editingId);
      if (
        current &&
        normalizeTeamSize(current.team_size) !== form.team_size &&
        current.compositions_count > 0
      ) {
        const ok = confirm(
          "Changer le type de match recalcule les postes des compositions (les joueurs hors format sont retirés). Continuer ?",
        );
        if (!ok) return;
      }
    }
    const payload = {
      ...form,
      team_size: normalizeTeamSize(form.team_size),
      score_home:
        form.score_home === null || Number.isNaN(form.score_home as number)
          ? null
          : Number(form.score_home),
      score_away:
        form.score_away === null || Number.isNaN(form.score_away as number)
          ? null
          : Number(form.score_away),
    };
    try {
      if (editingId) {
        await api.updateMatch(editingId, payload);
      } else {
        await api.createMatch(payload);
      }
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const onEdit = (m: Match) => {
    setEditingId(m.id);
    setForm({
      opponent: m.opponent,
      match_date: m.match_date,
      venue: m.venue,
      team_size: normalizeTeamSize(m.team_size),
      half_duration_minutes: m.half_duration_minutes || 35,
      score_home: m.score_home,
      score_away: m.score_away,
    });
  };

  const onDelete = async (id: number) => {
    if (!confirm("Supprimer ce match et ses compositions ?")) return;
    try {
      await api.deleteMatch(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const actions = (m: Match) => (
    <div className="row-actions">
      <Link className="btn btn-accent btn-sm" to={`/admin/matches/${m.id}/live`}>
        Mode match
      </Link>
      <Link className="btn btn-primary btn-sm" to={`/admin/matches/${m.id}`}>
        Compositions
      </Link>
      <button className="btn btn-ghost btn-sm" onClick={() => onEdit(m)}>
        Modifier
      </button>
      <button className="btn btn-danger btn-sm" onClick={() => onDelete(m.id)}>
        Supprimer
      </button>
    </div>
  );

  return (
    <div>
      <h1 className="page-title">Matchs</h1>
      <p className="page-sub">
        Créez les rencontres (XV, XII ou VII), saisissez les scores, puis composez.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <form className="toolbar" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="opponent">Adversaire</label>
            <input
              id="opponent"
              required
              value={form.opponent}
              onChange={(e) => setForm({ ...form, opponent: e.target.value })}
            />
          </div>
          <div className="field field-sm">
            <label htmlFor="date">Date</label>
            <input
              id="date"
              type="date"
              required
              value={form.match_date}
              onChange={(e) => setForm({ ...form, match_date: e.target.value })}
            />
          </div>
          <div className="field field-sm">
            <label htmlFor="venue">Lieu</label>
            <select
              id="venue"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
            >
              <option>Domicile</option>
              <option>Extérieur</option>
            </select>
          </div>
          <div className="field field-sm">
            <label htmlFor="team_size">Type</label>
            <select
              id="team_size"
              value={form.team_size}
              onChange={(e) =>
                setForm({
                  ...form,
                  team_size: normalizeTeamSize(Number(e.target.value)),
                })
              }
            >
              {TEAM_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {MATCH_FORMATS[size].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field field-xs">
            <label htmlFor="sh">Score nous</label>
            <input
              id="sh"
              type="number"
              min={0}
              value={form.score_home ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  score_home: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="field field-xs">
            <label htmlFor="sa">Score eux</label>
            <input
              id="sa"
              type="number"
              min={0}
              value={form.score_away ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  score_away: e.target.value === "" ? null : Number(e.target.value),
                })
              }
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
        ) : matches.length === 0 ? (
          <p className="empty">Aucun match pour le moment.</p>
        ) : (
          <>
            <div className="table-desktop">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Adversaire</th>
                    <th>Type</th>
                    <th>Lieu</th>
                    <th>Score</th>
                    <th>Compos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td>{new Date(m.match_date).toLocaleDateString("fr-FR")}</td>
                      <td>
                        <Link className="linkish" to={`/admin/matches/${m.id}`}>
                          vs {m.opponent}
                        </Link>
                      </td>
                      <td>{getMatchFormat(m.team_size).shortLabel}</td>
                      <td>{m.venue}</td>
                      <td className="score">
                        {m.score_home ?? "—"} – {m.score_away ?? "—"}
                      </td>
                      <td>{m.compositions_count}</td>
                      <td>{actions(m)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card-list">
              {matches.map((m) => (
                <article key={m.id} className="data-card">
                  <div className="data-card-head">
                    <Link className="linkish" to={`/admin/matches/${m.id}`}>
                      vs {m.opponent}
                    </Link>
                    <span className="score">
                      {m.score_home ?? "—"} – {m.score_away ?? "—"}
                    </span>
                  </div>
                  <p className="data-card-meta">
                    {new Date(m.match_date).toLocaleDateString("fr-FR")} ·{" "}
                    {getMatchFormat(m.team_size).shortLabel} · {m.venue} ·{" "}
                    {m.compositions_count} compo
                    {m.compositions_count > 1 ? "s" : ""}
                  </p>
                  {actions(m)}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
