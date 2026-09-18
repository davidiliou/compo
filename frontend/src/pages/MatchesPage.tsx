import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Match, TeamSize } from "../types";
import { MATCH_FORMATS, TEAM_SIZE_OPTIONS, getMatchFormat, normalizeTeamSize } from "../types";

const emptyForm = () => ({
  opponent: "",
  match_date: new Date().toISOString().slice(0, 10),
  venue: "Domicile",
  team_size: 15 as TeamSize,
  half_duration_minutes: 35,
  score_home: null as number | null,
  score_away: null as number | null,
});

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (m: Match) => {
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
    setFormError("");
    setModalOpen(true);
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
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await api.updateMatch(editingId, payload);
      } else {
        await api.createMatch(payload);
      }
      closeModal();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
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
      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openEdit(m)}>
        Modifier
      </button>
      <button className="btn btn-danger btn-sm" type="button" onClick={() => onDelete(m.id)}>
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
        <div className="toolbar">
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Ajouter un match
          </button>
        </div>
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

      {modalOpen && (
        <div
          className="slot-modal-backdrop"
          role="presentation"
          onClick={closeModal}
        >
          <form
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <div className="slot-modal-head">
              <h2 id="match-modal-title">
                {editingId ? "Modifier le match" : "Nouveau match"}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                Fermer
              </button>
            </div>

            {formError && <div className="error">{formError}</div>}

            <div className="player-modal-form">
              <div className="field">
                <label htmlFor="opponent">Adversaire</label>
                <input
                  id="opponent"
                  required
                  autoFocus
                  value={form.opponent}
                  onChange={(e) => setForm({ ...form, opponent: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="date">Date</label>
                <input
                  id="date"
                  type="date"
                  required
                  value={form.match_date}
                  onChange={(e) => setForm({ ...form, match_date: e.target.value })}
                />
              </div>
              <div className="field">
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
              <div className="field">
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
              <div className="field">
                <label htmlFor="half-dur">Durée mi-temps (min)</label>
                <input
                  id="half-dur"
                  type="number"
                  min={1}
                  max={60}
                  value={form.half_duration_minutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      half_duration_minutes: Number(e.target.value) || 35,
                    })
                  }
                />
              </div>
              <div className="field">
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
              <div className="field">
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
            </div>

            <div className="slot-modal-actions" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={closeModal}
                disabled={saving}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
