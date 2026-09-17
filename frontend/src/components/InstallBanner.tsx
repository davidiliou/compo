import { useEffect, useState } from "react";
import "./InstallBanner.css";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "compo-pwa-install-dismissed";

export default function InstallBanner() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    setDeferred(null);
  };

  const install = async () => {
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    else setVisible(false);
  };

  return (
    <div className="install-banner" role="region" aria-label="Installer l'application">
      <p>Installer Compo sur cet appareil pour un accès rapide.</p>
      <div className="install-banner-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
          Plus tard
        </button>
        <button type="button" className="btn btn-sm" onClick={install}>
          Installer
        </button>
      </div>
    </div>
  );
}
