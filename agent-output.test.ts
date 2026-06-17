import { test } from "node:test";
import assert from "node:assert/strict";
import { finalAnswerFor, FRIENDLY_ERROR } from "./agent-output";

test("ignora mensajes assistant intermedios", () => {
  assert.equal(finalAnswerFor({ type: "assistant" }), null);
});

test("ignora mensajes system", () => {
  assert.equal(finalAnswerFor({ type: "system", subtype: "init" }), null);
});

test("devuelve el texto final en result success", () => {
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "success", result: "El total facturado fue $1.234,56" }),
    "El total facturado fue $1.234,56"
  );
});

test("devuelve mensaje amable en result de error", () => {
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "error_during_execution" }),
    FRIENDLY_ERROR
  );
  assert.equal(
    finalAnswerFor({ type: "result", subtype: "error_max_turns" }),
    FRIENDLY_ERROR
  );
});
