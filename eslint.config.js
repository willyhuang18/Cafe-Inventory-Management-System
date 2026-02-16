import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                console: "readonly",
                process: "readonly",
                URL: "readonly",
                setTimeout: "readonly",
                clearTimeout: "readonly",
            },
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
            "prefer-const": "error",
            "no-var": "error",
            eqeqeq: ["error", "always"],
        },
    },
    {
        files: ["public/js/**/*.js"],
        languageOptions: {
            sourceType: "module",
            globals: {
                document: "readonly",
                window: "readonly",
                fetch: "readonly",
                alert: "readonly",
                confirm: "readonly",
                location: "readonly",
                bootstrap: "readonly",
            },
        },
    },
    { ignores: ["node_modules/"] },
];