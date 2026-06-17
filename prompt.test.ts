import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";

const prompt = () => fs.readFileSync(path.join(process.cwd(), "prompt.md"), "utf-8");

test("prompt.md prohibe exponer lo tecnico al cliente", () => {
  const p = prompt().toLowerCase();
  assert.ok(p.includes("nunca"), "debe contener una prohibicion explicita");
  assert.ok(p.includes("sql"), "debe prohibir mencionar SQL");
  assert.ok(p.includes("tabla"), "debe prohibir mencionar tablas");
  assert.ok(p.includes("cliente"), "debe enmarcar el rol hacia el cliente final");
});

test("prompt.md ancla la jerga a sus tablas catalogo", () => {
  const p = prompt();
  assert.ok(p.includes("os"), "debe anclar obras sociales a la tabla os");
  assert.ok(p.includes("headquarters"), "debe anclar sede a headquarters");
  assert.ok(p.includes("laboratories"), "debe anclar laboratorio a laboratories");
});

test("el conocimiento de dominio vive en las skills", () => {
  const skills = ["facturacion", "obras-sociales", "practicas", "costos-margenes"];
  for (const s of skills) {
    const file = path.join(process.cwd(), ".claude", "skills", s, "SKILL.md");
    assert.ok(fs.existsSync(file), "falta la skill " + s);
  }
});
