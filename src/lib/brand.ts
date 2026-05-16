export type OpenGolinkTheme = "open-golinks" | "zgzg";

export type BrandConfig = {
  theme: OpenGolinkTheme;
  productName: string;
  genericName: string;
  homepageLabel: string;
  shortDescription: string;
  instanceDescription: string;
  appIconHref: string;
  warningIconHref: string;
  brandColor: string;
  brandStrongColor: string;
  brandSoftColor: string;
  brandForegroundColor: string;
  lightBrandColor: string;
  lightBrandStrongColor: string;
  lightBrandSoftColor: string;
  lightBrandForegroundColor: string;
  actionPrimaryColor: string;
  actionPrimaryHoverColor: string;
  actionPrimaryForegroundColor: string;
  lightActionPrimaryColor: string;
  lightActionPrimaryHoverColor: string;
  lightActionPrimaryForegroundColor: string;
  warningColor: string;
  warningSoftColor: string;
  warningForegroundColor: string;
  lightWarningColor: string;
  lightWarningSoftColor: string;
  lightWarningForegroundColor: string;
};

const DEFAULT_APP_ICON_HREF =
  "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23ff7a45%22%2F%3E%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23ff5c1f%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2214%22%20fill%3D%22url(%23g)%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2258%25%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22middle%22%20font-family%3D%22ui-sans-serif%2C%20system-ui%2C%20-apple-system%2C%20Inter%2C%20sans-serif%22%20font-weight%3D%22700%22%20font-size%3D%2234%22%20fill%3D%22%231a0700%22%3Eo%2F%3C%2Ftext%3E%3C%2Fsvg%3E";

const DEFAULT_WARNING_ICON_HREF =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23ff7a45'/%3E%3Cpath d='M32 12 56 52H8L32 12Z' fill='%23101014'/%3E%3Ccircle cx='32' cy='45' r='3' fill='%23ff7a45'/%3E%3Cpath d='M30 25h4v15h-4z' fill='%23ff7a45'/%3E%3C/svg%3E";

const ZGZG_ICON_HREF = "/zgzg-round-logo.png";

const DEFAULT_BRAND: BrandConfig = {
  theme: "open-golinks",
  productName: "Open GoLinks",
  genericName: "Open GoLinks",
  homepageLabel: "Open GoLinks 首页",
  shortDescription: "开源、可自部署的 go/links 短链服务",
  instanceDescription:
    "Open GoLinks: 开源、可自部署的 go/links 短链服务. 匿名可用, 公私可控, 内置访问统计.",
  appIconHref: DEFAULT_APP_ICON_HREF,
  warningIconHref: DEFAULT_WARNING_ICON_HREF,
  brandColor: "#ff7a45",
  brandStrongColor: "#ff5c1f",
  brandSoftColor: "rgba(255, 122, 69, 0.14)",
  brandForegroundColor: "#1a0700",
  lightBrandColor: "#ea580c",
  lightBrandStrongColor: "#c2410c",
  lightBrandSoftColor: "rgba(234, 88, 12, 0.10)",
  lightBrandForegroundColor: "#ffffff",
  actionPrimaryColor: "#ff7a45",
  actionPrimaryHoverColor: "#ff5c1f",
  actionPrimaryForegroundColor: "#1a0700",
  lightActionPrimaryColor: "#ea580c",
  lightActionPrimaryHoverColor: "#c2410c",
  lightActionPrimaryForegroundColor: "#ffffff",
  warningColor: "#f59e0b",
  warningSoftColor: "rgba(245, 158, 11, 0.16)",
  warningForegroundColor: "#1f1300",
  lightWarningColor: "#d97706",
  lightWarningSoftColor: "rgba(217, 119, 6, 0.12)",
  lightWarningForegroundColor: "#ffffff",
};

const ZGZG_BRAND: BrandConfig = {
  theme: "zgzg",
  productName: "zgzg.li",
  genericName: "Open GoLinks",
  homepageLabel: "zgzg.li 首页",
  shortDescription: "ZGZG 的团队短链服务",
  instanceDescription:
    "zgzg.li 是一个 Open GoLinks 实例, 支持语义化短链、登录后管理、二维码下载和访问统计.",
  appIconHref: ZGZG_ICON_HREF,
  warningIconHref: ZGZG_ICON_HREF,
  brandColor: "#d71920",
  brandStrongColor: "#b51218",
  brandSoftColor: "rgba(215, 25, 32, 0.14)",
  brandForegroundColor: "#ffffff",
  lightBrandColor: "#d71920",
  lightBrandStrongColor: "#b51218",
  lightBrandSoftColor: "rgba(215, 25, 32, 0.10)",
  lightBrandForegroundColor: "#ffffff",
  actionPrimaryColor: "#f4f4f5",
  actionPrimaryHoverColor: "#ffffff",
  actionPrimaryForegroundColor: "#111113",
  lightActionPrimaryColor: "#18181b",
  lightActionPrimaryHoverColor: "#27272a",
  lightActionPrimaryForegroundColor: "#ffffff",
  warningColor: "#f59e0b",
  warningSoftColor: "rgba(245, 158, 11, 0.16)",
  warningForegroundColor: "#1f1300",
  lightWarningColor: "#d97706",
  lightWarningSoftColor: "rgba(217, 119, 6, 0.12)",
  lightWarningForegroundColor: "#ffffff",
};

export function normalizeOpenGolinkTheme(value: string | undefined | null): OpenGolinkTheme {
  return value?.trim().toLowerCase() === "zgzg" ? "zgzg" : "open-golinks";
}

export function getBrandConfig(themeValue?: string | null): BrandConfig {
  return normalizeOpenGolinkTheme(themeValue) === "zgzg" ? ZGZG_BRAND : DEFAULT_BRAND;
}

export function getRuntimeBrandConfig() {
  return getBrandConfig(process.env.OPEN_GOLINK_THEME);
}
