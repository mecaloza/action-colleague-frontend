/**
 * The simulators' formula language, as the server reads it (backend app/services/formula.py): arithmetic on the
 * declared controls, `min` and `max`. It is parsed and walked, never evaluated as code. The learner sees the live
 * result; the server confirms it.
 *
 *   expr   := term (("+" | "-") term)*
 *   term   := factor (("*" | "/") factor)*
 *   factor := ("+" | "-") factor | number | variable | ("min" | "max") "(" expr "," expr ")" | "(" expr ")"
 */

export const MAX_FORMULA_CHARS = 200;
const MAX_DEPTH = 32;

export class FormulaError extends Error {}

type Node =
  | { kind: "num"; value: number }
  | { kind: "var"; name: string }
  | { kind: "neg"; operand: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/"; left: Node; right: Node }
  | { kind: "call"; name: "min" | "max"; left: Node; right: Node };

type Token = { kind: "num" | "name" | "op"; value: string };

// Global (ES5 has no sticky flag): every position matches (spaces, then a number, a name or any symbol).
// Spaces are only " \t\r\n" and digits only 0-9, on both sides: no Unicode lookalike passes in one and not the other.
const TOKEN = /[ \t\r\n]*(?:([0-9]+(?:\.[0-9]+)?|\.[0-9]+)|([A-Za-z_][A-Za-z0-9_]*)|(.))/g;

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const source = text.replace(/[ \t\r\n]+$/, "");
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < source.length) {
    const start = TOKEN.lastIndex;
    const match = TOKEN.exec(source);
    if (!match || match.index !== start) break;
    const [, number, name, symbol] = match;
    if (number !== undefined) tokens.push({ kind: "num", value: number });
    else if (name !== undefined) tokens.push({ kind: "name", value: name });
    else if ("+-*/(),".includes(symbol)) tokens.push({ kind: "op", value: symbol });
    else throw new FormulaError(`La fórmula tiene un símbolo no permitido: «${symbol}».`);
  }
  return tokens;
}

export function parseFormula(text: string, variables: string[]): Node {
  text = text.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, ""); // the server strips it before checking its length
  if (!text) throw new FormulaError("Escribe la fórmula del simulador.");
  if (text.length > MAX_FORMULA_CHARS) throw new FormulaError("La fórmula es demasiado larga.");
  const tokens = tokenize(text);
  const known = new Set(variables);
  let position = 0;
  const peek = () => tokens[position];
  const take = (value?: string) => {
    const token = tokens[position];
    if (!token || (value !== undefined && token.value !== value)) {
      throw new FormulaError(value ? `A la fórmula le falta «${value}».` : "La fórmula está incompleta.");
    }
    position += 1;
    return token;
  };
  const expr = (depth: number): Node => {
    let node = term(depth);
    while (peek() && (peek().value === "+" || peek().value === "-")) {
      const op = take().value as "+" | "-";
      node = { kind: "bin", op, left: node, right: term(depth) };
    }
    return node;
  };
  const term = (depth: number): Node => {
    let node = factor(depth);
    while (peek() && (peek().value === "*" || peek().value === "/")) {
      const op = take().value as "*" | "/";
      node = { kind: "bin", op, left: node, right: factor(depth) };
    }
    return node;
  };
  const factor = (depth: number): Node => {
    if (depth > MAX_DEPTH) throw new FormulaError("La fórmula está demasiado anidada.");
    const token = take();
    if (token.kind === "op" && (token.value === "+" || token.value === "-")) {
      const operand = factor(depth + 1);
      return token.value === "-" ? { kind: "neg", operand } : operand;
    }
    if (token.kind === "num") return { kind: "num", value: Number(token.value) };
    if (token.kind === "name" && (token.value === "min" || token.value === "max")) {
      take("(");
      const left = expr(depth + 1);
      take(",");
      const right = expr(depth + 1);
      take(")");
      return { kind: "call", name: token.value, left, right };
    }
    if (token.kind === "name") {
      if (!known.has(token.value)) {
        throw new FormulaError(`La fórmula usa «${token.value}», que no es una de las variables del simulador.`);
      }
      return { kind: "var", name: token.value };
    }
    if (token.value === "(") {
      const node = expr(depth + 1);
      take(")");
      return node;
    }
    throw new FormulaError(`La fórmula no se entiende cerca de «${token.value}».`);
  };
  const node = expr(0);
  if (peek()) throw new FormulaError(`La fórmula no se entiende cerca de «${peek().value}».`);
  return node;
}

export function evaluateFormula(node: Node, values: Record<string, number>): number {
  let result: number;
  switch (node.kind) {
    case "num":
      result = node.value;
      break;
    case "var":
      result = values[node.name];
      break;
    case "neg":
      result = -evaluateFormula(node.operand, values);
      break;
    case "call":
      result = Math[node.name](evaluateFormula(node.left, values), evaluateFormula(node.right, values));
      break;
    case "bin": {
      const a = evaluateFormula(node.left, values);
      const b = evaluateFormula(node.right, values);
      if (node.op === "/" && b === 0)
        throw new FormulaError("La fórmula divide entre cero con algunos valores de los controles.");
      result = node.op === "+" ? a + b : node.op === "-" ? a - b : node.op === "*" ? a * b : a / b;
    }
  }
  if (!Number.isFinite(result)) throw new FormulaError("La fórmula da un resultado que no es un número.");
  return result;
}

/** The formula's value for these controls, or null when it can't be computed (the server has the last word). */
export function computeFormula(text: string, values: Record<string, number>): number | null {
  try {
    return evaluateFormula(parseFormula(text, Object.keys(values)), values);
  } catch {
    return null;
  }
}
