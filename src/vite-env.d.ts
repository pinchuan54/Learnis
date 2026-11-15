/// <reference types="vite/client" />

/** 应用版本号，构建时从 package.json 注入；内部测试包带构建号，如 `0.1.2+3` */
declare const __APP_VERSION__: string;

/** 内部测试包的提交号（如 `8cbbce1`，有未提交改动时带 `-dirty`）；正式版为空 */
declare const __BUILD_COMMIT__: string;
