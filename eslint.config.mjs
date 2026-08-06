import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Next/vinext 栈已删除（Web 入口由 apps/expo 接管），不再依赖 eslint-config-next。
const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  globalIgnores([
    "dist/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "apps/native/capacitor-shell/**",
    "apps/native/ios/App/App/public/**",
    "apps/native/ios/**",
    "apps/expo/**",
  ]),
]);

export default eslintConfig;
