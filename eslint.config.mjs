import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    rules: {
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    ignores: [
      ".codex/**",
      "coverage/**",
      "supabase/.branches/**",
      "supabase/.temp/**",
      "tsconfig.tsbuildinfo",
    ],
  },
];

export default eslintConfig;
