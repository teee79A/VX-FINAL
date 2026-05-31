module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@vyrdx-boundary-internal/runtime-exec",
            message: "Modules may not import runtime execution."
          },
          {
            name: "@terminal-core/command-bus/internal-executor",
            message: "Modules may not bypass command bus."
          }
        ],
        patterns: [
          "**/vyrdx/**/execute*",
          "**/vyrdx/**/seal*"
        ]
      }
    ]
  }
};
