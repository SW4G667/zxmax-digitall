import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface SiteBranding {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  supportUrl: string;
}

const defaults: SiteBranding = {
  siteName: "ZXMAX",
  logoUrl: "",
  faviconUrl: "",
  heroTitle: "Compre e venda produtos digitais com segurança",
  heroSubtitle: "Marketplace para produtos, serviços e itens digitais.",
  supportUrl: "https://discord.gg/zxmax",
};

type Ctx = {
  branding: SiteBranding;
  refreshBranding: () => Promise<void>;
};

const SiteBrandingContext = createContext<Ctx>({ branding: defaults, refreshBranding: async () => {} });

export function SiteBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<SiteBranding>(defaults);

  const refreshBranding = async () => {
    try {
      // Lazy-load the configured client only when the provider actually needs
      // remote branding. Consumers can use the safe defaults without requiring
      // Supabase environment variables at module-import time.
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("site-config", { body: { action: "get" } });
      if (!error && data?.branding) setBranding({ ...defaults, ...data.branding });
    } catch {
      // Keep safe local defaults if the public config endpoint is temporarily unavailable.
    }
  };

  useEffect(() => { void refreshBranding(); }, []);

  useEffect(() => {
    document.title = branding.siteName || "ZXMAX";
    if (!branding.faviconUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }, [branding.siteName, branding.faviconUrl]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding]);
  return <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>;
}

export function useSiteBranding() {
  return useContext(SiteBrandingContext);
}
