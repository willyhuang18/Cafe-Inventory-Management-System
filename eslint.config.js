import globals from "globals";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import prettier from "eslint-plugin-prettier";

export default [
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2025,
      },
    },
    plugins: {
      prettier: prettier,
    },

    rules: {
      // ESLint recommended rules
      ...js.configs.recommended.rules,

      indent: [
        "error",
        2,
        {
          SwitchCase: 1,
        },
      ],

      "linebreak-style": ["error", "unix"],
      quotes: ["error", "double"],
      semi: ["error", "always"],
      "no-console": 0,

      // Prettier integration - this runs Prettier through ESLint
      "prettier/prettier": [
        "error",
        {
          endOfLine: "lf",
        },
      ],
    },
  },
  eslintConfigPrettier,
];
