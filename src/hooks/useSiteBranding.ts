import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SiteBranding {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  supportUrl: string;
}

export const DEFAULT_SITE_BRANDING: SiteBranding = {
  siteName: "ZXMAX",
  logoUrl: "",
  faviconUrl: "",
  heroTitle: "Compre e venda produtos digitais com segurança",
  heroSubtitle: "Marketplace para produtos, serviços e itens digitais.",
  supportUrl: "https://discord.gg/zxmax",
};

const EVENT = "zxmax:branding-updated";
let cached: SiteBranding | null = null;

function applyDocumentBranding(branding: SiteBranding) {
  if (typeof document === "undefined") return;
  document.title = `${branding.siteName} — Marketplace Digital`;
  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}

export function emitBranding(branding: SiteBranding) {
  cached = branding;
  applyDocumentBranding(branding);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: branding }));
}

export default function useSiteBranding() {
  const [branding, setBranding] = useState<SiteBranding>(cached || DEFAULT_SITE_BRANDING);
  const [loading, setLoading] = useState(!cached);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("site-config", { body: { action: "get" } });
    if (!error && data?.branding) {
      const next = { ...DEFAULT_SITE_BRANDING, ...data.branding } as SiteBranding;
      emitBranding(next);
      setBranding(next);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<SiteBranding>).detail;
      if (next) setBranding(next);
    };
    window.addEventListener(EVENT, listener);
    if (!cached) void refresh();
    else applyDocumentBranding(cached);
    return () => window.removeEventListener(EVENT, listener);
  }, [refresh]);

  return { branding, loading, refresh };
}
