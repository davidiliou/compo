import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import type { TrainingExercise, TrainingTemplate } from "../types";
import { DEFAULT_TRAINING_THEMES } from "../types";
import "./TrainingPages.css";

type ExerciseDraft = Omit<TrainingExercise, "id">;

const emptyExercise = (): ExerciseDraft => ({
  title: "",
  description: "",
  duration_minutes: 10,
  sort_order: 0,
});

const emptyForm = () => ({
  title: "",
  description: "",
  themes: [] as string[],
  exercises: [emptyExercise()] as ExerciseDraft[],
});

export default function TrainingTemplatesPage() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([
    ...DEFAULT_TRAINING_THEMES,
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [customTheme, setCustomTheme] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const totalMinutes = useMemo(
    () => form.exercises.reduce((sum, e) => sum + (e.duration_minutes || 0), 0),
    [form.exercises],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [tpls, themes] = await Promise.all([
        api.getTrainingTemplates(),
        api.getTrainingThemes(),
      ]);
      setTemplates(tpls);
      setSuggestedThemes(themes.themes || [...DEFAULT_TRAINING_THEMES]);
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

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm());
    setCustomTheme("");
    setFormError("");
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (t: TrainingTemplate) => {
    setEditingId(t.id);
    setForm({
      title: t.title,
      description: t.description || "",
      themes: [...(t.themes || [])],
      exercises:
        t.exercises?.length > 0
          ? t.exercises.map((e, i) => ({
              title: e.title,
              description: e.description || "",
              duration_minutes: e.duration_minutes,
              sort_order: e.sort_order ?? i,
            }))
          : [emptyExercise()],
    });
    setFormError("");
    setModalOpen(true);
  };

  const toggleTheme = (theme: string) => {
    setForm((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  };

  const addCustomTheme = () => {
    const t = customTheme.trim().toLowerCase();
    if (!t) return;
    if (!form.themes.includes(t)) {
      setForm({ ...form, themes: [...form.themes, t] });
    }
    if (!suggestedThemes.includes(t)) {
      setSuggestedThemes([...suggestedThemes, t]);
    }
    setCustomTheme("");
  };

  const updateExercise = (index: number, patch: Partial<ExerciseDraft>) => {
    setForm((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i === index ? { ...ex, ...patch } : ex,
      ),
    }));
  };

  const addExercise = () => {
    setForm((prev) => ({
      ...prev,
      exercises: [...prev.exercises, emptyExercise()],
    }));
    requestAnimationFrame(() => {
      const body = document.querySelector(".training-modal-body");
      if (body) body.scrollTop = body.scrollHeight;
    });
  };

  const removeExercise = (index: number) => {
    setForm((prev) => ({
      ...prev,
      exercises:
        prev.exercises.length <= 1
          ? prev.exercises
          : prev.exercises.filter((_, i) => i !== index),
    }));
  };

  const moveExercise = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= form.exercises.length) return;
    setForm((prev) => {
      const next = [...prev.exercises];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return { ...prev, exercises: next };
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const exercises = form.exercises
      .map((ex, i) => ({
        title: ex.title.trim(),
        description: ex.description.trim(),
        duration_minutes: Math.max(1, Number(ex.duration_minutes) || 10),
        sort_order: i,
      }))
      .filter((ex) => ex.title);

    if (!form.title.trim()) {
      setFormError("Titre requis");
      return;
    }
    if (exercises.length === 0) {
      setFormError("Ajoutez au moins un exercice / atelier");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        themes: form.themes,
        exercises,
      };
      if (editingId) {
        await api.updateTrainingTemplate(editingId, payload);
      } else {
        await api.createTrainingTemplate(payload);
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
    if (!confirm("Supprimer cet entraînement type ?")) return;
    try {
      await api.deleteTrainingTemplate(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  return (
    <div>
      <h1 className="page-title">Entraînements types</h1>
      <p className="page-sub">
        Bibliothèque d’entraînements réutilisables : titre, description, thèmes et
        ateliers chronométrés.
      </p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar">
          <Link className="btn btn-ghost" to="/admin/training">
            ← Saisons
          </Link>
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            Nouvel entraînement
          </button>
        </div>
      </div>

      <div className="panel">
        {loading ? (
          <p className="empty">Chargement…</p>
        ) : templates.length === 0 ? (
          <p className="empty">Aucun entraînement type pour le moment.</p>
        ) : (
          <div className="training-template-list">
            {templates.map((t) => (
              <article key={t.id} className="training-template-card">
                <div className="training-template-head">
                  <div>
                    <h2>{t.title}</h2>
                    <p className="data-card-meta" style={{ marginBottom: 0 }}>
                      {t.total_duration_minutes} min · {t.exercises.length} atelier
                      {t.exercises.length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      className="btn btn-accent btn-sm"
                      type="button"
                      onClick={() =>
                        navigate(`/admin/training/session/${t.id}`)
                      }
                    >
                      Ouvrir
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => openEdit(t)}
                    >
                      Modifier
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      type="button"
                      onClick={() => onDelete(t.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
                {t.themes.length > 0 && (
                  <div className="theme-chips">
                    {t.themes.map((theme) => (
                      <span key={theme} className="theme-chip">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
                {t.description && (
                  <p className="training-desc">{t.description}</p>
                )}
                <ol className="exercise-preview">
                  {t.exercises.map((ex) => (
                    <li key={ex.id ?? ex.title}>
                      <strong>{ex.title}</strong>
                      <span className="exercise-time">{ex.duration_minutes} min</span>
                      {ex.description && <p>{ex.description}</p>}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="training-modal-backdrop" role="presentation">
          <form
            className="training-modal"
            role="dialog"
            aria-modal="true"
            onSubmit={onSubmit}
          >
            <div className="training-modal-head">
              <h2>
                {editingId ? "Modifier l’entraînement" : "Nouvel entraînement"}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
              >
                Fermer
              </button>
            </div>

            <div className="training-modal-body">
              {formError && <div className="error">{formError}</div>}

              <div className="training-field">
                <label htmlFor="tpl-title">Titre</label>
                <input
                  id="tpl-title"
                  required
                  autoFocus
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Défense individuelle + collectif de ligne"
                />
              </div>

              <div className="training-field">
                <label htmlFor="tpl-desc">Description</label>
                <textarea
                  id="tpl-desc"
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              <div className="training-field">
                <label>Thèmes</label>
                <div className="theme-chips theme-chips-edit">
                  {suggestedThemes.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={
                        form.themes.includes(theme)
                          ? "theme-chip theme-chip-active"
                          : "theme-chip theme-chip-btn"
                      }
                      onClick={() => toggleTheme(theme)}
                    >
                      {theme}
                    </button>
                  ))}
                </div>
                <div className="training-field-row" style={{ marginTop: "0.35rem" }}>
                  <div className="training-field">
                    <label htmlFor="custom-theme">Autre thème</label>
                    <input
                      id="custom-theme"
                      value={customTheme}
                      onChange={(e) => setCustomTheme(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addCustomTheme();
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={addCustomTheme}
                  >
                    Ajouter
                  </button>
                </div>
              </div>

              <div className="exercises-editor">
                <div className="exercises-editor-head">
                  <h3>
                    Ateliers / exercices{" "}
                    <span className="muted-inline">({totalMinutes} min)</span>
                  </h3>
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={addExercise}
                  >
                    + Atelier
                  </button>
                </div>

                {form.exercises.map((ex, index) => (
                  <div key={index} className="exercise-edit-block">
                    <div className="exercise-edit-toolbar">
                      <span className="exercise-index">#{index + 1}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => moveExercise(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => moveExercise(index, 1)}
                        disabled={index === form.exercises.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeExercise(index)}
                        disabled={form.exercises.length <= 1}
                      >
                        Retirer
                      </button>
                    </div>
                    <div className="training-field-row">
                      <div className="training-field">
                        <label>Titre</label>
                        <input
                          required
                          value={ex.title}
                          onChange={(e) =>
                            updateExercise(index, { title: e.target.value })
                          }
                          placeholder="Ex. Échauffement cardio et musculaire"
                        />
                      </div>
                      <div className="training-field training-field-sm">
                        <label>Durée (min)</label>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={ex.duration_minutes}
                          onChange={(e) =>
                            updateExercise(index, {
                              duration_minutes: Number(e.target.value) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="training-field training-field-full">
                        <label>Description</label>
                        <textarea
                          rows={3}
                          value={ex.description}
                          onChange={(e) =>
                            updateExercise(index, {
                              description: e.target.value,
                            })
                          }
                          placeholder="Détail de l’atelier, consignes, variantes…"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="training-modal-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving
                  ? "Enregistrement…"
                  : editingId
                    ? "Enregistrer"
                    : "Créer"}
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
