import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const ignores = [
  "dist/**",
  "coverage/**",
  "node_modules/**",
  "eslint.config.mjs",
  "vitest.config.ts"
];

export default tseslint.config(
  {
    ignores
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["test/*.ts"]
        },
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "inline-type-imports"
        }
      ],
      "@typescript-eslint/no-explicit-any": "error"
    }
  }
);
