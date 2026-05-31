import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "state/brain-backups/**"]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
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
          patterns: ["**/vyrdx/**/execute*", "**/vyrdx/**/seal*"]
        }
      ]
    }
  },
  {
    files: ["modules/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: "Modules may not use raw PostgreSQL clients." },
            { name: "pg-pool", message: "Modules may not use raw PostgreSQL pools." },
            { name: "redis", message: "Modules may not use raw Redis clients." },
            { name: "ioredis", message: "Modules may not use raw Redis clients." },
            { name: "mongodb", message: "Modules may not use raw MongoDB clients." },
            { name: "mongoose", message: "Modules may not use raw MongoDB ODM access." },
            { name: "mysql2", message: "Modules may not use raw MySQL clients." },
            { name: "@prisma/client", message: "Modules may not use raw Prisma access." },
            { name: "typeorm", message: "Modules may not use raw TypeORM access." },
            { name: "sequelize", message: "Modules may not use raw Sequelize access." },
            {
              name: "@terminal-core/command-bus/internal-executor",
              message: "Modules may not bypass command bus."
            },
            {
              name: "@vyrdx-boundary-internal/runtime-exec",
              message: "Modules may not import runtime execution."
            }
          ],
          patterns: [
            "**/command-bus/*",
            "**/vyrdx/**/execute*",
            "**/vyrdx/**/seal*"
          ]
        }
      ]
    }
  }
];
