import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import CompositionBoard from "../components/CompositionBoard";
import type { Composition, Match, Player } from "../types";

export default function MatchDetailPage() {
  const { id } = useParams();
  const matchId = Number(id);

  const [match, setMatch] = useState<Match | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newName, setNewName] = useState("XV de départ");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, comps, pls] = await Promise.all([
        api.getMatch(matchId),
        api.getCompositions(matchId),
        api.getPlayers(),
      ]);
      setMatch(m);
      setCompositions(comps);
      setPlayers(pls);
      setActiveId((prev) => {
        if (prev && comps.some((c) => c.id === prev)) return prev;
        return comps[0]?.id ?? null;
      });
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    load();
  }, [matchId, load]);

  const active = compositions.find((c) => c.id === activeId) ?? null;

  const createCompo = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createComposition(matchId, newName.trim() || "Composition");
      setNewName("XV de départ");
      await load();
      setActiveId(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const renameCompo = async () => {
    if (!active) return;
    const name = prompt("Nouveau nom de la composition", active.name);
    if (!name?.trim()) return;
    try {
      await api.updateComposition(active.id, name.trim());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const deleteCompo = async () => {
    if (!active) return;
    if (!confirm(`Supprimer « ${active.name} » ?`)) return;
    try {
      await api.deleteComposition(active.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    }
  };

  const onSlotsChange = async (
    slots: { position: number; player_id: number | null }[],
  ) => {
    if (!active) return;
    setSaving(true);
    try {
      const updated = await api.updateSlots(active.id, slots);
      setCompositions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="empty">Chargement…</p>;
  if (!match) return <p className="empty">Match introuvable.</p>;

  return (
    <div>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link className="linkish" to="/">
          ← Retour aux matchs
        </Link>
      </p>
      <h1 className="page-title">vs {match.opponent}</h1>
      <p className="page-sub">
        {new Date(match.match_date).toLocaleDateString("fr-FR")} · {match.venue} ·{" "}
        <span className="score">
          {match.score_home ?? "—"} – {match.score_away ?? "—"}
        </span>
      </p>

      {error && <div className="error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <form className="toolbar" onSubmit={createCompo}>
          <div className="field">
            <label htmlFor="compo-name">Nouvelle composition</label>
            <input
              id="compo-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="XV de départ, Remplaçants…"
            />
          </div>
          <button className="btn btn-primary" type="submit">
            Ajouter une compo
          </button>
        </form>

        {compositions.length > 0 && (
          <div className="row-actions" style={{ marginTop: "0.5rem" }}>
            {compositions.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`btn btn-sm ${c.id === activeId ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveId(c.id)}
              >
                {c.name}
              </button>
            ))}
            {active && (
              <>
                <button className="btn btn-ghost btn-sm" type="button" onClick={renameCompo}>
                  Renommer
                </button>
                <button className="btn btn-danger btn-sm" type="button" onClick={deleteCompo}>
                  Supprimer
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {players.length === 0 ? (
        <div className="panel">
          <p className="empty">
            Ajoutez d’abord des joueurs dans{" "}
            <Link className="linkish" to="/players">
              l’effectif
            </Link>
            .
          </p>
        </div>
      ) : !active ? (
        <div className="panel">
          <p className="empty">Créez une composition pour commencer le placement.</p>
        </div>
      ) : (
        <CompositionBoard
          composition={active}
          players={players}
          onChange={onSlotsChange}
          saving={saving}
        />
      )}
    </div>
  );
}
