import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import PublicPitchView from "../components/PublicPitchView";
import type { Composition, Match } from "../types";
import { getMatchFormat, normalizeTeamSize } from "../types";

export default function VisitorMatchPage() {
  const { id } = useParams();
  const matchId = Number(id);
  const [match, setMatch] = useState<Match | null>(null);
  const [compositions, setCompositions] = useState<Composition[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, comps] = await Promise.all([
        api.publicGetMatch(matchId),
        api.publicGetCompositions(matchId),
      ]);
      setMatch(m);
      setCompositions(comps);
      setActiveId(comps[0]?.id ?? null);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    if (!Number.isFinite(matchId)) return;
    load();
  }, [matchId, load]);

  if (loading) return <p className="empty">Chargement…</p>;
  if (!match) return <p className="empty">Match introuvable.</p>;

  const format = getMatchFormat(normalizeTeamSize(match.team_size));
  const active = compositions.find((c) => c.id === activeId) ?? null;

  return (
    <div style={{ maxWidth: "44rem", margin: "0 auto" }}>
      <p style={{ marginBottom: "0.5rem" }}>
        <Link className="linkish" to="/">
          ← Accueil
        </Link>
      </p>
      <h1 className="page-title">vs {match.opponent}</h1>
      <p className="page-sub">
        {new Date(match.match_date).toLocaleDateString("fr-FR")} · {match.venue} ·{" "}
        {format.shortLabel} ·{" "}
        <span className="score">
          {match.score_home ?? "—"} – {match.score_away ?? "—"}
        </span>
      </p>

      <div className="row-actions" style={{ marginBottom: "1rem" }}>
        <Link className="btn btn-accent" to={`/match/${match.id}/live`}>
          Suivre le match
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="panel">
        <h2 style={{ marginTop: 0, fontFamily: "var(--font-display)", color: "var(--green-deep)" }}>
          Composition publique
        </h2>
        {compositions.length === 0 ? (
          <p className="empty">
            Aucune composition publiée pour ce match pour le moment.
          </p>
        ) : (
          <>
            {compositions.length > 1 && (
              <div className="row-actions" style={{ marginBottom: "0.75rem" }}>
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
              </div>
            )}
            {active && (
              <>
                <p className="page-sub" style={{ marginTop: 0 }}>
                  {active.name}
                </p>
                <PublicPitchView composition={active} teamSize={format.teamSize} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
