import { test, expect } from "@playwright/test";
import { evaluateFormula, FormulaError, parseFormula } from "../src/lib/formula";
import cases from "./fixtures/formula_cases.json";

// The simulators' formulas compute in the browser exactly as on the server: the same cases as
// backend/tests/fixtures/formula_cases.json (keep both copies equal).

test.describe("fórmulas del simulador", () => {
  for (const item of cases.valid) {
    test(`calcula ${item.formula}`, () => {
      const variables = item.variables as Record<string, number>;
      const tree = parseFormula(item.formula, Object.keys(variables));
      expect(evaluateFormula(tree, variables)).toBeCloseTo(item.result, 9);
    });
  }

  for (const item of cases.invalid) {
    test(`rechaza «${item.formula || "vacía"}»`, () => {
      expect(() => parseFormula(item.formula, item.variables)).toThrow(FormulaError);
    });
  }

  test("una división entre cero se reporta", () => {
    const { formula, variables } = cases.division_by_zero;
    expect(() => evaluateFormula(parseFormula(formula, Object.keys(variables)), variables)).toThrow(
      /divide entre cero/,
    );
  });
});
