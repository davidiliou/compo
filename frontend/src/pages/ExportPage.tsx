import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";
import CompositionExport from "../components/CompositionExport";
import type { Composition, Match } from "../types";

export default function ExportPage() {
  const { matchId, compositionId } = useParams();
  const [searchParams] = useSearchParams();
  const mid = Number(matchId);
  const cid = Number(compositionId);
  const shouldPrint = searchParams.get("print") === "1";

  const [match, setMatch] = useState<Match | null>(null);
  const [composition, setComposition] = useState<Composition | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(mid) || !Number.isFinite(cid)) return;
    (async () => {
      try {
        const [m, comps] = await Promise.all([
          api.getMatch(mid),
          api.getCompositions(mid),
        ]);
        const comp = comps.find((c) => c.id === cid) ?? null;
        setMatch(m);
        setComposition(comp);
        if (!comp) setError("Composition introuvable");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
  }, [mid, cid]);

  useEffect(() => {
    if (!shouldPrint || loading || !composition || !match) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [shouldPrint, loading, composition, match]);

  if (loading) return <p className="empty">Chargement de l’export…</p>;
  if (error || !match || !composition) {
    return (
      <div>
        <p className="error">{error || "Données manquantes"}</p>
        <Link className="linkish" to={`/admin/matches/${mid}`}>
          ← Retour
        </Link>
      </div>
    );
  }

  return (
    <CompositionExport
      match={match}
      composition={composition}
      onClose={() => {
        window.history.back();
      }}
    />
  );
}
