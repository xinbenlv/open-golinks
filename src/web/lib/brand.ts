import { getBrandConfig } from "../../lib/brand";
import zgzgLogoUrl from "../../assets/img/zgzg-round-logo.png";

const brand = getBrandConfig(import.meta.env.VITE_OPEN_GOLINK_THEME);

export const webBrand = {
  ...brand,
  logoUrl: brand.theme === "zgzg" ? zgzgLogoUrl : null,
};

export function applyBrandTheme() {
  document.documentElement.dataset.brand = webBrand.theme;
}
