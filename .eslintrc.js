// https://typescript-eslint.io/docs/linting/
// trunk-ignore(eslint/no-undef)
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // trunk-ignore(eslint/no-undef)
    tsconfigRootDir: __dirname,
    project: [
      "./tsconfig.json",
      "./packages/*/tsconfig.json",
      "./*/tsconfig.json",
    ],
  },
  plugins: ["@typescript-eslint", "jest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:jest/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
  ],
};
