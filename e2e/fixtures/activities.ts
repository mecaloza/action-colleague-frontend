// Activities used by the e2e specs (the same ones the backend tests use).
export const DECISION = {
  nodes: [
    {
      id: "inicio",
      speaker: "Cliente",
      situation: "Solo quiero la llanta más barata para mi flota.",
      choices: [
        {
          id: "precio",
          text: "Le doy la más barata.",
          points: 2,
          feedback: "Vendes hoy, pero el costo por kilómetro sube.",
          next: "",
        },
        {
          id: "pregunta",
          text: "¿Qué ruta y carga manejan?",
          points: 6,
          feedback: "Entiendes la aplicación antes de cotizar.",
          next: "ruta",
        },
      ],
    },
    {
      id: "ruta",
      speaker: "Cliente",
      situation: "Carretera, 40 toneladas, 12 mil km al mes.",
      choices: [
        {
          id: "cpk",
          text: "Le muestro el costo por kilómetro.",
          points: 4,
          feedback: "El cliente ve el ahorro en números.",
          next: "",
        },
        {
          id: "marca",
          text: "Le hablo de la marca.",
          points: 1,
          feedback: "Sin números, el precio vuelve a mandar.",
          next: "",
        },
      ],
    },
  ],
};

export const INSPECTION = {
  prompt: "Encuentra los dos problemas de desgaste.",
  zones: [
    {
      id: "hombros",
      label: "Hombros gastados",
      x: 0.05,
      y: 0.1,
      w: 0.2,
      h: 0.3,
      is_problem: true,
      explanation: "Desgaste en ambos hombros: baja presión o sobrecarga.",
      placed: true,
    },
    {
      id: "centro",
      label: "Centro gastado",
      x: 0.4,
      y: 0.1,
      w: 0.2,
      h: 0.3,
      is_problem: true,
      explanation: "Desgaste en el centro: exceso de presión.",
      placed: true,
    },
    {
      id: "parejo",
      label: "Desgaste parejo",
      x: 0.7,
      y: 0.1,
      w: 0.2,
      h: 0.3,
      is_problem: false,
      explanation: "Esta llanta está bien: desgaste uniforme.",
      placed: true,
    },
  ],
};

export const SIMULATOR = {
  prompt: "Baja el costo por kilómetro a menos de $0.050.",
  variables: [
    { key: "precio", label: "Precio de la llanta", unit: "MXN", min: 4000, max: 12000, step: 500, default: 6000 },
    { key: "km", label: "Kilómetros de vida", unit: "km", min: 60000, max: 250000, step: 10000, default: 100000 },
  ],
  formula: "precio / km",
  output: { label: "Costo por kilómetro", unit: "MXN/km", decimals: 3 },
  target: { op: "lte", value: 0.05 },
  success_text: "Así se vende: más vida útil, menos costo por kilómetro.",
  fail_text: "Todavía no: prueba con más kilómetros de vida.",
  hint: "Una llanta renovable rinde más kilómetros.",
};

export const QUICK_ORDER = {
  mode: "order",
  prompt: "Ordena la revisión en patio.",
  seconds: 40,
  items: ["Medir presión en frío", "Revisar desgaste", "Leer el DOT", "Registrar y recomendar"],
};

// A 1x1 PNG: the picture an inspection is played on (its zones are fractions of whatever size it shows at).
export const PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
