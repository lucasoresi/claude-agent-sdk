import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

const prompt = () => fs.readFileSync(path.join(process.cwd(), "prompt.md"), "utf-8");

test("prompt.md prohíbe exponer lo técnico al cliente", () => {
  const p = prompt().toLowerCase();
  assert.ok(p.includes("nunca"), "debe contener una prohibición explícita");
  assert.ok(p.includes("sql"), "debe prohibir mencionar SQL");
  assert.ok(p.includes("tabla"), "debe prohibir mencionar tablas");
  assert.ok(p.includes("cliente"), "debe enmarcar el rol hacia el cliente final");
});

test("prompt.md conserva conocimiento de dominio interno", () => {
  const p = prompt();
  assert.ok(p.includes("reportings_full_view"), "debe incluir las vistas de dominio");
  assert.ok(p.includes("total_amount = billed_amount"), "debe incluir las fórmulas");
});
