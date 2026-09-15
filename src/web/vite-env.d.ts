/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPEN_GOLINK_THEME?: string;
}

// Jazzicon 的官方包未内置类型；只接收尺寸与数值 seed。
declare module "@metamask/jazzicon" {
  export default function jazzicon(diameter: number, seed: number): HTMLElement;
}
