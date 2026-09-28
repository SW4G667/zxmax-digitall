import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface SiteBranding {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  heroTitle: string;
  heroSubtitle: string;
  heroBannerUrl: string;
  robuxBannerUrl: string;
  promoBanner1Url: string;
  promoBanner2Url: string;
  promoBanner3Url: string;
  accentColor: string;
  supportUrl: string;
}

const defaults: SiteBranding = {
  siteName: "ZXMAX",
  logoUrl: "",
  faviconUrl: "",
  heroTitle: "Compre e venda produtos digitais",
  heroSubtitle: "Encontre ofertas, acompanhe seus pedidos e anuncie com um fluxo simples e seguro.",
  heroBannerUrl: "",
  robuxBannerUrl: "",
  promoBanner1Url: "",
  promoBanner2Url: "",
  promoBanner3Url: "",
  accentColor: "#168cff",
  supportUrl: "https://discord.gg/zxmax",
};

type Ctx = {
  branding: SiteBranding;
  refreshBranding: () => Promise<void>;
};

const SiteBrandingContext = createContext<Ctx>({ branding: defaults, refreshBranding: async () => {} });

function upsertMeta(selector: string, attr: "property" | "name", key: string, value: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = value;
}

export function SiteBrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<SiteBranding>(defaults);

  const refreshBranding = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke("site-config", { body: { action: "get" } });
      if (!error && data?.branding) setBranding({ ...defaults, ...data.branding });
    } catch {
      // Keep safe local defaults if the public config endpoint is temporarily unavailable.
    }
  };

  useEffect(() => { void refreshBranding(); }, []);

  useEffect(() => {
    const siteName = branding.siteName || "ZXMAX";
    document.title = `${siteName} | Marketplace Digital`;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl || "/favicon.ico";

    document.documentElement.style.setProperty("--zx-accent", branding.accentColor || "#168cff");
    document.documentElement.style.setProperty("--zx-accent-soft", `${branding.accentColor || "#168cff"}20`);

    const description = branding.heroSubtitle || defaults.heroSubtitle;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", `${siteName} | Marketplace Digital`);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", `${siteName} | Marketplace Digital`);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);

    // O ZXMAX não publica uma imagem de preview social configurável.
    // Isso evita que uma foto enviada no Admin apareça fora do site quando
    // alguém compartilha um link.
    document.head.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach((node) => node.remove());
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary");
  }, [branding]);

  const value = useMemo(() => ({ branding, refreshBranding }), [branding]);
  return <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>;
}

export function useSiteBranding() {
  return useContext(SiteBrandingContext);
}
