export type OpenGolinkTheme = "open-golinks" | "zgzg";

export type BrandConfig = {
  theme: OpenGolinkTheme;
  productName: string;
  genericName: string;
  homepageLabel: string;
  shortDescription: string;
  instanceDescription: string;
  primaryColor: string;
  primaryStrongColor: string;
  primarySoftColor: string;
  primaryForegroundColor: string;
};

const DEFAULT_BRAND: BrandConfig = {
  theme: "open-golinks",
  productName: "Open GoLinks",
  genericName: "Open GoLinks",
  homepageLabel: "Open GoLinks 首页",
  shortDescription: "开源、可自部署的 go/links 短链服务",
  instanceDescription:
    "Open GoLinks: 开源、可自部署的 go/links 短链服务. 匿名可用, 公私可控, 内置访问统计.",
  primaryColor: "#ff7a45",
  primaryStrongColor: "#ff5c1f",
  primarySoftColor: "rgba(255, 122, 69, 0.14)",
  primaryForegroundColor: "#1a0700",
};

const ZGZG_BRAND: BrandConfig = {
  theme: "zgzg",
  productName: "zgzg.li",
  genericName: "Open GoLinks",
  homepageLabel: "zgzg.li 首页",
  shortDescription: "ZGZG 的团队短链服务",
  instanceDescription:
    "zgzg.li 是一个 Open GoLinks 实例, 支持语义化短链、登录后管理、二维码下载和访问统计.",
  primaryColor: "#d71920",
  primaryStrongColor: "#b51218",
  primarySoftColor: "rgba(215, 25, 32, 0.14)",
  primaryForegroundColor: "#ffffff",
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
