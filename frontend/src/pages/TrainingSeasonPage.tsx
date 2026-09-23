import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type {
  TrainingPeriod,
  TrainingSeason,
  TrainingTemplate,
  TrainingWeeklySlotInput,
} from "../types";
import { DEFAULT_TRAINING_THEMES, WEEKDAYS_FR } from "../types";
import "./TrainingPages.css";
import "./TrainingSessionPage.css";

type SlotDraft = TrainingWeeklySlotInput;

const emptyPeriod = (season: TrainingSeason) => ({
  name: "",
  start_date: season.start_date,
  end_date: season.end_date,
  themes: [] as string[],
  notes: "",
});

export default function TrainingSeasonPage() {
  const { id } = useParams();
  const seasonId = Number(id);
  const navigate = useNavigate();

  const [season, setSeason] = useState<TrainingSeason | null>(null);
  const [templates, setTemplates] = useState<TrainingTemplate[]>([]);
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([
    ...DEFAULT_TRAINING_THEMES,
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [slotsModal, setSlotsModal] = useState(false);
  const [slotsDraft, setSlotsDraft] = useState<SlotDraft[]>([]);
  const [seasonMeta, setSeasonMeta] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });
  const [savingSlots, setSavingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const [periodModal, setPeriodModal] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState<number | null>(null);
  const [periodForm, setPeriodForm] = useState({
    name: "",
    start_date: "",
    end_date: "",
    themes: [] as string[],
    notes: "",
  });
  const [customTheme, setCustomTheme] = useState("");
  const [periodError, setPeriodError] = useState("");
  const [savingPeriod, setSavingPeriod] = useState(false);

  const [assignPeriodId, setAssignPeriodId] = useState<number | null>(null);
  const [assignTemplateId, setAssignTemplateId] = useState<number | "">("");
  const [assignSlotId, setAssignSlotId] = useState<number | "all">("all");
  const [assignError, setAssignError] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);

  const load = async () => {
    if (!Number.isFinite(seasonId)) {
      setError("Saison invalide");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [s, tpls, themes] = await Promise.all([
        api.getTrainingSeason(seasonId),
        api.getTrainingTemplates(),
        api.getTrainingThemes(),
      ]);
      setSeason(s);
      setSeasonMeta({
        name: s.name,
        start_date: s.start_date,
        end_date: s.end_date,
      });
      setSlotsDraft(
        s.slots.map((slot, i) => ({
          weekday: slot.weekday,
          duration_minutes: slot.duration_minutes,
          label: slot.label || WEEKDAYS_FR[slot.weekday],
          sort_order: slot.sort_order ?? i,
        })),
      );
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
  }, [seasonId]);

  const openSlotsModal = () => {
    if (!season) return;
    setSeasonMeta({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
    });
    setSlotsDraft(
      season.slots.map((slot, i) => ({
        weekday: slot.weekday,
        duration_minutes: slot.duration_minutes,
        label: slot.label || WEEKDAYS_FR[slot.weekday],
        sort_order: slot.sort_order ?? i,
      })),
    );
    setSlotsError("");
    setSlotsModal(true);
  };

  const saveSeasonConfig = async (e: FormEvent) => {
    e.preventDefault();
    if (!season) return;
    setSavingSlots(true);
    setMessage("");
    setError("");
    setSlotsError("");
    try {
      const updated = await api.updateTrainingSeason(season.id, {
        name: seasonMeta.name.trim(),
        start_date: seasonMeta.start_date,
        end_date: seasonMeta.end_date,
        slots: slotsDraft.map((s, i) => ({
          ...s,
          label: s.label.trim() || WEEKDAYS_FR[s.weekday],
          sort_order: i,
        })),
      });
      setSeason(updated);
      setSlotsDraft(
        updated.slots.map((slot, i) => ({
          weekday: slot.weekday,
          duration_minutes: slot.duration_minutes,
          label: slot.label || WEEKDAYS_FR[slot.weekday],
          sort_order: slot.sort_order ?? i,
        })),
      );
      setSeasonMeta({
        name: updated.name,
        start_date: updated.start_date,
        end_date: updated.end_date,
      });
      setSlotsModal(false);
      setMessage("Créneaux et saison enregistrés.");
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingSlots(false);
    }
  };

  const addSlot = () => {
    setSlotsDraft((prev) => [
      ...prev,
      {
        weekday: 2,
        duration_minutes: 90,
        label: "Mercredi",
        sort_order: prev.length,
      },
    ]);
  };

  const removeSlot = (index: number) => {
    setSlotsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSlot = (index: number, patch: Partial<SlotDraft>) => {
    setSlotsDraft((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...patch };
        if (patch.weekday !== undefined && !s.label) {
          next.label = WEEKDAYS_FR[patch.weekday];
        }
        return next;
      }),
    );
  };

  const openCreatePeriod = () => {
    if (!season) return;
    setEditingPeriodId(null);
    setPeriodForm(emptyPeriod(season));
    setCustomTheme("");
    setPeriodError("");
    setPeriodModal(true);
  };

  const openEditPeriod = (p: TrainingPeriod) => {
    setEditingPeriodId(p.id);
    setPeriodForm({
      name: p.name || "",
      start_date: p.start_date,
      end_date: p.end_date,
      themes: [...(p.themes || [])],
      notes: p.notes || "",
    });
    setCustomTheme("");
    setPeriodError("");
    setPeriodModal(true);
  };

  const toggleTheme = (theme: string) => {
    setPeriodForm((prev) => ({
      ...prev,
      themes: prev.themes.includes(theme)
        ? prev.themes.filter((t) => t !== theme)
        : [...prev.themes, theme],
    }));
  };

  const addCustomTheme = () => {
    const t = customTheme.trim().toLowerCase();
    if (!t) return;
    if (!periodForm.themes.includes(t)) {
      setPeriodForm({ ...periodForm, themes: [...periodForm.themes, t] });
    }
    if (!suggestedThemes.includes(t)) {
      setSuggestedThemes([...suggestedThemes, t]);
    }
    setCustomTheme("");
  };

  const savePeriod = async (e: FormEvent) => {
    e.preventDefault();
    if (!season) return;
    setSavingPeriod(true);
    setPeriodError("");
    try {
      const payload = {
        name: periodForm.name.trim(),
        start_date: periodForm.start_date,
        end_date: periodForm.end_date,
        themes: periodForm.themes,
        notes: periodForm.notes.trim(),
      };
      if (editingPeriodId) {
        await api.updateTrainingPeriod(editingPeriodId, payload);
      } else {
        await api.createTrainingPeriod(season.id, payload);
      }
      setPeriodModal(false);
      await load();
    } catch (err) {
      setPeriodError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingPeriod(false);
    }
  };

  const deletePeriod = async (periodId: number) => {
    if (!confirm("Supprimer cette période et ses affectations ?")) return;
    try {
      await api.deleteTrainingPeriod(periodId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const openAssign = (periodId: number) => {
    setAssignPeriodId(periodId);
    setAssignTemplateId(templates[0]?.id ?? "");
    setAssignSlotId("all");
    setAssignError("");
  };

  const saveAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (assignPeriodId == null || assignTemplateId === "") return;
    setSavingAssign(true);
    setAssignError("");
    try {
      await api.createTrainingAssignment(assignPeriodId, {
        template_id: Number(assignTemplateId),
        weekly_slot_id: assignSlotId === "all" ? null : Number(assignSlotId),
      });
      setAssignPeriodId(null);
      await load();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingAssign(false);
    }
  };

  const deleteAssignment = async (assignmentId: number) => {
    if (!confirm("Retirer cette affectation ?")) return;
    try {
      await api.deleteTrainingAssignment(assignmentId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  if (loading) {
    return <p className="empty">Chargement…</p>;
  }

  if (!season) {
    return (
      <div>
        {error && <div className="error">{error}</div>}
        <Link className="btn btn-ghost" to="/admin/training">
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">{season.name}</h1>
      <p className="page-sub">
        {new Date(season.start_date).toLocaleDateString("fr-FR")} →{" "}
        {new Date(season.end_date).toLocaleDateString("fr-FR")}
      </p>

      {error && <div className="error">{error}</div>}
      {message && <div className="success">{message}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar">
          <Link className="btn btn-ghost" to="/admin/training">
            ← Saisons
          </Link>
          <Link className="btn btn-accent" to="/admin/training/templates">
            Bibliothèque
          </Link>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="toolbar" style={{ marginBottom: "0.5rem" }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Créneaux hebdomadaires
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openSlotsModal}
          >
            Modifier / ajouter
          </button>
        </div>
        {season.slots.length === 0 ? (
          <p className="empty" style={{ padding: "1rem 0" }}>
            Aucun créneau. Cliquez sur « Modifier / ajouter ».
          </p>
        ) : (
          <div className="slots-summary">
            {season.slots.map((slot) => (
              <span key={slot.id} className="slot-chip">
                {slot.label || slot.weekday_label || WEEKDAYS_FR[slot.weekday]}
                <span className="muted-inline">· {slot.duration_minutes} min</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="toolbar" style={{ marginBottom: "1rem" }}>
          <h2 className="section-title" style={{ margin: 0, flex: 1 }}>
            Périodes thématiques
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openCreatePeriod}
          >
            Nouvelle période
          </button>
        </div>

        {season.periods.length === 0 ? (
          <p className="empty">
            Aucune période. Définissez des plages (ex. sept–oct : défense) et
            affectez un entraînement type à un créneau ou à tous.
          </p>
        ) : (
          <div className="period-list">
            {season.periods.map((period) => (
              <article key={period.id} className="period-card">
                <div className="period-card-head">
                  <div>
                    <h3>{period.name || "Période sans nom"}</h3>
                    <p className="data-card-meta" style={{ marginBottom: 0 }}>
                      {new Date(period.start_date).toLocaleDateString("fr-FR")} →{" "}
                      {new Date(period.end_date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="btn btn-accent btn-sm"
                      onClick={() => openAssign(period.id)}
                    >
                      Affecter
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEditPeriod(period)}
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => deletePeriod(period.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {period.themes.length > 0 && (
                  <div className="theme-chips">
                    {period.themes.map((theme) => (
                      <span key={theme} className="theme-chip">
                        {theme}
                      </span>
                    ))}
                  </div>
                )}

                {period.notes && <p className="training-desc">{period.notes}</p>}

                {period.assignments.length === 0 ? (
                  <p className="muted-inline">Aucun entraînement affecté.</p>
                ) : (
                  <ul className="assignment-list">
                    {period.assignments.map((a) => (
                      <li key={a.id}>
                        <div>
                          <button
                            type="button"
                            className="assignment-link"
                            onClick={() =>
                              navigate(
                                `/admin/training/session/${a.template_id}?season=${season.id}`,
                              )
                            }
                          >
                            {a.template?.title || "Entraînement"}
                          </button>
                          <span className="muted-inline">
                            {" "}
                            ·{" "}
                            {a.weekly_slot
                              ? a.weekly_slot.label ||
                                a.weekly_slot.weekday_label
                              : "Tous les créneaux"}
                            {a.template
                              ? ` · ${a.template.total_duration_minutes} min`
                              : ""}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => deleteAssignment(a.id)}
                        >
                          Retirer
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {slotsModal && (
        <div className="training-modal-backdrop" role="presentation">
          <form
            className="training-modal"
            role="dialog"
            aria-modal="true"
            onSubmit={saveSeasonConfig}
          >
            <div className="training-modal-head">
              <h2>Créneaux de la saison</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setSlotsModal(false)}
              >
                Fermer
              </button>
            </div>
            <div className="training-modal-body">
              {slotsError && <div className="error">{slotsError}</div>}
              <div className="training-field-row">
                <div className="training-field">
                  <label htmlFor="s-name">Nom de saison</label>
                  <input
                    id="s-name"
                    required
                    value={seasonMeta.name}
                    onChange={(e) =>
                      setSeasonMeta({ ...seasonMeta, name: e.target.value })
                    }
                  />
                </div>
                <div className="training-field">
                  <label htmlFor="s-start">Début</label>
                  <input
                    id="s-start"
                    type="date"
                    required
                    value={seasonMeta.start_date}
                    onChange={(e) =>
                      setSeasonMeta({
                        ...seasonMeta,
                        start_date: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="training-field">
                  <label htmlFor="s-end">Fin</label>
                  <input
                    id="s-end"
                    type="date"
                    required
                    value={seasonMeta.end_date}
                    onChange={(e) =>
                      setSeasonMeta({ ...seasonMeta, end_date: e.target.value })
                    }
                  />
                </div>
              </div>

              {slotsDraft.length === 0 ? (
                <p className="empty">Aucun créneau. Ajoutez au moins un jour.</p>
              ) : (
                <div className="slots-editor">
                  {slotsDraft.map((slot, index) => (
                    <div key={index} className="slot-row">
                      <div className="training-field" style={{ flex: "1 1 140px" }}>
                        <label>Jour</label>
                        <select
                          value={slot.weekday}
                          onChange={(e) => {
                            const weekday = Number(e.target.value);
                            updateSlot(index, {
                              weekday,
                              label: WEEKDAYS_FR[weekday],
                            });
                          }}
                        >
                          {WEEKDAYS_FR.map((label, day) => (
                            <option key={label} value={day}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="training-field" style={{ flex: "1 1 140px" }}>
                        <label>Libellé</label>
                        <input
                          value={slot.label}
                          onChange={(e) =>
                            updateSlot(index, { label: e.target.value })
                          }
                        />
                      </div>
                      <div className="training-field training-field-sm">
                        <label>Durée (min)</label>
                        <input
                          type="number"
                          min={15}
                          max={300}
                          value={slot.duration_minutes}
                          onChange={(e) =>
                            updateSlot(index, {
                              duration_minutes: Number(e.target.value) || 90,
                            })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeSlot(index)}
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="training-modal-actions">
              <button type="button" className="btn btn-ghost" onClick={addSlot}>
                + Créneau
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingSlots || slotsDraft.length === 0}
              >
                {savingSlots ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSlotsModal(false)}
                disabled={savingSlots}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {periodModal && (
        <div
          className="slot-modal-backdrop"
          role="presentation"
          onClick={() => setPeriodModal(false)}
        >
          <form
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={savePeriod}
          >
            <div className="slot-modal-head">
              <h2>
                {editingPeriodId ? "Modifier la période" : "Nouvelle période"}
              </h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPeriodModal(false)}
              >
                Fermer
              </button>
            </div>
            {periodError && <div className="error">{periodError}</div>}
            <div className="player-modal-form">
              <div className="field">
                <label htmlFor="p-name">Nom</label>
                <input
                  id="p-name"
                  value={periodForm.name}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, name: e.target.value })
                  }
                  placeholder="Ex. Bloc défense"
                />
              </div>
              <div className="field">
                <label htmlFor="p-start">Début</label>
                <input
                  id="p-start"
                  type="date"
                  required
                  value={periodForm.start_date}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, start_date: e.target.value })
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="p-end">Fin</label>
                <input
                  id="p-end"
                  type="date"
                  required
                  value={periodForm.end_date}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, end_date: e.target.value })
                  }
                />
              </div>
              <div className="field" style={{ flex: "1 1 100%" }}>
                <label htmlFor="p-notes">Notes</label>
                <textarea
                  id="p-notes"
                  rows={2}
                  value={periodForm.notes}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, notes: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="field" style={{ marginTop: "0.75rem" }}>
              <label>Thèmes</label>
              <div className="theme-chips theme-chips-edit">
                {suggestedThemes.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    className={
                      periodForm.themes.includes(theme)
                        ? "theme-chip theme-chip-active"
                        : "theme-chip theme-chip-btn"
                    }
                    onClick={() => toggleTheme(theme)}
                  >
                    {theme}
                  </button>
                ))}
              </div>
              <div className="toolbar" style={{ marginTop: "0.5rem" }}>
                <div className="field field-sm">
                  <label htmlFor="p-custom-theme">Autre thème</label>
                  <input
                    id="p-custom-theme"
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

            <div className="slot-modal-actions" style={{ marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={savingPeriod}
              >
                {savingPeriod
                  ? "Enregistrement…"
                  : editingPeriodId
                    ? "Enregistrer"
                    : "Créer"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setPeriodModal(false)}
                disabled={savingPeriod}
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {assignPeriodId != null && (
        <div
          className="slot-modal-backdrop"
          role="presentation"
          onClick={() => setAssignPeriodId(null)}
        >
          <form
            className="slot-modal panel"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            onSubmit={saveAssignment}
          >
            <div className="slot-modal-head">
              <h2>Affecter un entraînement</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setAssignPeriodId(null)}
              >
                Fermer
              </button>
            </div>
            {assignError && <div className="error">{assignError}</div>}
            {templates.length === 0 ? (
              <p className="empty">
                Créez d’abord un entraînement type dans la{" "}
                <Link className="linkish" to="/admin/training/templates">
                  bibliothèque
                </Link>
                .
              </p>
            ) : (
              <div className="player-modal-form">
                <div className="field">
                  <label htmlFor="a-tpl">Entraînement type</label>
                  <select
                    id="a-tpl"
                    required
                    value={assignTemplateId}
                    onChange={(e) =>
                      setAssignTemplateId(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.total_duration_minutes} min)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="a-slot">Créneau</label>
                  <select
                    id="a-slot"
                    value={assignSlotId === "all" ? "all" : String(assignSlotId)}
                    onChange={(e) =>
                      setAssignSlotId(
                        e.target.value === "all" ? "all" : Number(e.target.value),
                      )
                    }
                  >
                    <option value="all">Tous les créneaux</option>
                    {season.slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || s.weekday_label} ({s.duration_minutes} min)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="slot-modal-actions" style={{ marginTop: "1rem" }}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={savingAssign || templates.length === 0}
              >
                {savingAssign ? "Affectation…" : "Affecter"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setAssignPeriodId(null)}
                disabled={savingAssign}
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
