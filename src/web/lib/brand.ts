import { getBrandConfig } from "../../lib/brand";

function getWebThemeValue() {
  const viteTheme = import.meta.env?.VITE_OPEN_GOLINK_THEME;
  if (typeof viteTheme === "string") return viteTheme;
  if (typeof process !== "undefined") return process.env.OPEN_GOLINK_THEME;
  return undefined;
}

const brand = getBrandConfig(getWebThemeValue());

export const webBrand = {
  ...brand,
  logoUrl: brand.theme === "zgzg" ? brand.appIconHref : null,
};

export function applyBrandTheme() {
  document.documentElement.dataset.brand = webBrand.theme;
  const icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (icon) {
    icon.href = webBrand.appIconHref;
    icon.type = webBrand.appIconHref.endsWith(".png") ? "image/png" : "image/svg+xml";
  }
}
