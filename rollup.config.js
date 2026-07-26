import typescript from "@rollup/plugin-typescript";
import cjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";

export default {
  // Точка входа в наш проект
  input: "src/index.ts",

  // Настройки вывода
  output: {
    // Имя и формат итогового файла
    file: "dist/index.js",
    format: "cjs", // CommonJS для Node.js
  },
  plugins: [typescript(), cjs(), resolve()],
};
