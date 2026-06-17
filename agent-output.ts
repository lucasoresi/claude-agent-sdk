export const FRIENDLY_ERROR =
  "No pude obtener esa información en este momento. ¿Querés que lo intente de otra forma?";

type ResultLike = { type: string; subtype?: string; result?: string };

// Dado un mensaje del SDK, devuelve el texto final si es el resultado
// terminal, o null si es un mensaje intermedio que el cliente no debe ver.
export function finalAnswerFor(msg: ResultLike): string | null {
  if (msg.type !== "result") return null;
  if (msg.subtype === "success") {
    return msg.result && msg.result.trim() !== "" ? msg.result : FRIENDLY_ERROR;
  }
  return FRIENDLY_ERROR;
}
