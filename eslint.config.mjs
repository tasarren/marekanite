import globals from "globals"
import importX from "eslint-plugin-import-x"
import js from "@eslint/js"
import stylistic from "@stylistic/eslint-plugin"
import tseslint from "typescript-eslint"
import unusedImports from "eslint-plugin-unused-imports"
import vue from "eslint-plugin-vue"
import vueParser from "vue-eslint-parser"
import {createTypeScriptImportResolver} from "eslint-import-resolver-typescript"
import {defineConfig} from "eslint/config"


const tsFiles = ["**/*.ts", "**/*.mts", "**/*.cts", "**/*.tsx"]
const vueFiles = ["**/*.vue"]

const configFiles = ["eslint.config.mjs"]
const typedTypeScriptConfigs = tseslint.configs.strictTypeChecked.map((config) => ({
  ...config,
  files: tsFiles,
}))

const workspaceImportRestrictions = [
  {
    regex: "^\\.\\.(?:/\\.\\.)*/(?:packages)/",
    message: "Use bare workspace aliases for cross-package imports.",
  },
]

const tsconfigProjects = [
  "./tsconfig.json",
  "./packages/*/tsconfig.json",
  "./packages/admin-web/tsconfig.json",
]

const sharedRules = {
  "@stylistic/indent": ["error", 2],
  "@stylistic/semi": ["error", "never"],
  "@stylistic/no-extra-semi": "error",
  "@stylistic/quotes": ["error", "double"],
  "@stylistic/comma-dangle": ["error", "always-multiline"],
  "@stylistic/object-curly-spacing": ["error", "always"],
  "@stylistic/array-bracket-spacing": ["error", "never"],
  "@stylistic/space-before-blocks": "error",
  "@stylistic/space-before-function-paren": ["error", "never"],
  "@stylistic/space-infix-ops": "error",
  "@stylistic/key-spacing": "error",
  "@stylistic/keyword-spacing": "error",
  "@stylistic/eol-last": ["error", "always"],
  "@stylistic/no-trailing-spaces": "error",

  "import-x/first": "error",
  "import-x/no-duplicates": "error",
  "import-x/newline-after-import": "error",
  "import-x/no-self-import": "error",
  "import-x/no-useless-path-segments": "error",
  "import-x/no-relative-packages": "error",

  "unused-imports/no-unused-imports": "error",

  "no-unused-vars": "off",
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],

  "@typescript-eslint/no-invalid-void-type": "off",
  "@typescript-eslint/require-await": "off",
  "@typescript-eslint/restrict-template-expressions": ["error", {allowNumber: true}],
  "@typescript-eslint/no-non-null-assertion": "off",
  "@typescript-eslint/no-unnecessary-type-parameters": "off",
  "@typescript-eslint/preserve-caught-error": "off",

  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",

  "no-restricted-imports": [
    "error",
    {
      patterns: workspaceImportRestrictions,
    },
  ],

  "no-console": "error",
}

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.tsbuildinfo",
      "docs/**",
      ".orchestrator/**",
      ".extract/**",
      ".cache/**",
      "artifacts/**",
      "data/**",
    ],
  },

  js.configs.recommended,
  ...typedTypeScriptConfigs,
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: tsFiles,
    plugins: {
      "@stylistic": stylistic,
      "@typescript-eslint": tseslint.plugin,
      "import-x": importX,
      "unused-imports": unusedImports,
    },
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: {
          allowDefaultProject: configFiles,
        },
        noWarnOnMultipleProjects: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: tsconfigProjects,
        }),
      ],
    },
    rules: sharedRules,
  },

  ...vue.configs["flat/recommended"],

  {
    files: vueFiles,
    plugins: {
      "@stylistic": stylistic,
      "@typescript-eslint": tseslint.plugin,
      "import-x": importX,
      "unused-imports": unusedImports,
      vue,
    },
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
        projectService: {
          allowDefaultProject: configFiles,
        },
        noWarnOnMultipleProjects: true,
        tsconfigRootDir: import.meta.dirname,
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      "import-x/resolver-next": [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: tsconfigProjects,
        }),
      ],
    },
    rules: {
      ...sharedRules,
      "vue/singleline-html-element-content-newline": "off",
      "vue/max-attributes-per-line": "off",
      "vue/multi-word-component-names": "off",
      "vue/block-order": [
        "error",
        {
          order: ["script", "template", "style"],
        },
      ],
      "vue/component-api-style": ["error", ["script-setup"]],
      "vue/component-name-in-template-casing": ["error", "PascalCase"],
      "vue/custom-event-name-casing": ["error", "kebab-case", {ignores: ["/^update:[a-zA-Z]+$/u"]}],
      "vue/define-macros-order": [
        "error",
        {
          order: ["defineOptions", "defineProps", "defineEmits", "defineSlots"],
        },
      ],
      "vue/no-unused-refs": "error",
      "vue/no-useless-mustaches": "error",
      "vue/no-useless-v-bind": "error",
      "vue/padding-line-between-blocks": "error",
      "vue/prefer-separate-static-class": "error",
    },
  },

  {
    files: ["**/*.test.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      "max-lines": "off",
      "no-console": "off",
    },
  },

  {
    files: [
      "packages/client-patch/src/cli.ts",
      "packages/sync-server/**/*.ts",
    ],
    rules: {
      "no-console": "off",
    },
  },

  {
    // Protocol / SQLite / deprecated public aliases — not worth rewriting this pass.
    files: tsFiles,
    rules: {
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-unnecessary-type-conversion": "off",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
      "@typescript-eslint/preserve-caught-error": "off",
    },
  },
)
