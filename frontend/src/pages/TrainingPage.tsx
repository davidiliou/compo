import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { TrainingSeasonSummary } from "../types";
import "./TrainingPages.css";

function defaultSeasonDates() {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    name: `${year}-${year + 1}`,
    start_date: `${year}-09-01`,
    end_date: `${year + 1}-06-30`,
  };
}

export default function TrainingPage() {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<TrainingSeasonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultSeasonDates);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSeasons(await api.getTrainingSeasons());
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
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  const openCreate = () => {
    setForm(defaultSeasonDates());
    setFormError("");
    setModalOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const created = await api.createTrainingSeason({
        ...form,
        slots: [
          { weekday: 2, duration_minutes: 90, label: "Mercredi", sort_order: 0 },
          { weekday: 4, duration_minutes: 90, label: "Vendredi", sort_order: 1 },
        ],
      });
      setModalOpen(false);
      navigate(`/admin/training/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Supprimer cette saison et toutes ses périodes ?")) return;
    try {
      await api.deleteTrainingSeason(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div>
      <h1 className="page-title">Entraînements</h1>
      <p className="page-sub">
        Planifiez la saison (septembre → juin), les créneaux hebdo et les thèmes
        par période.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar">
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Nouvelle saison
          </button>
          <Link className="btn btn-accent" to="/admin/training/templates">
            Bibliothèque d’entraînements
          </Link>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <p className="empty">Chargement…</p>
        ) : seasons.length === 0 ? (
          <p className="empty">
            Aucune saison. Créez-en une pour démarrer la planification.
          </p>
        ) : (
          <>
            <div className="table-desktop">
              <table className="table">
                <thead>
                  <tr>
                    <th>Saison</th>
                    <th>Période</th>
                    <th>Créneaux</th>
                    <th>Thématiques</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <Link className="linkish" to={`/admin/training/${s.id}`}>
                          {s.name}
                        </Link>
                      </td>
                      <td>
                        {new Date(s.start_date).toLocaleDateString("fr-FR")} →{" "}
                        {new Date(s.end_date).toLocaleDateString("fr-FR")}
                      </td>
                      <td>{s.slots_count}</td>
                      <td>{s.periods_count}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="btn btn-primary btn-sm"
                            to={`/admin/training/${s.id}`}
                          >
                            Ouvrir
                          </Link>
                          <button
                            className="btn btn-danger btn-sm"
                            type="button"
                            onClick={() => onDelete(s.id)}
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
              {seasons.map((s) => (
                <article key={s.id} className="data-card">
                  <div className="data-card-head">
                    <Link className="linkish" to={`/admin/training/${s.id}`}>
                      {s.name}
                    </Link>
                  </div>
                  <p className="data-card-meta">
                    {new Date(s.start_date).toLocaleDateString("fr-FR")} →{" "}
                    {new Date(s.end_date).toLocaleDateString("fr-FR")} ·{" "}
                    {s.slots_count} créneau{s.slots_count !== 1 ? "x" : ""} ·{" "}
                    {s.periods_count} période{s.periods_count > 1 ? "s" : ""}
                  </p>
                  <div className="row-actions">
                    <Link
                      className="btn btn-primary btn-sm"
                      to={`/admin/training/${s.id}`}
                    >
                      Ouvrir
                    </Link>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={() => onDelete(s.id)}
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

      {modalOpen && (
        <div
          className="slot-modal-backdrop"
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <form
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmit}
          >
            <div className="slot-modal-head">
              <h2>Nouvelle saison</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setModalOpen(false)}
              >
                Fermer
              </button>
            </div>
            {formError && <div className="error">{formError}</div>}
            <div className="player-modal-form">
              <div className="field">
                <label htmlFor="season-name">Nom</label>
                <input
                  id="season-name"
                  required
                  autoFocus
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="season-start">Début</label>
                <input
                  id="season-start"
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) =>
                    setForm({ ...form, start_date: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="season-end">Fin</label>
                <input
                  id="season-end"
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>
            <p className="page-sub" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
              Deux créneaux (mercredi / vendredi, 90 min) seront créés par défaut —
              modifiables ensuite.
            </p>
            <div className="slot-modal-actions" style={{ marginTop: "1rem" }}>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Création…" : "Créer"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setModalOpen(false)}
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
