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
  prompt: "Revisa las 4 llantas antes de que salga la unidad.",
  scene: "truck",
  verdicts: [
    { id: "rodar", label: "Sigue rodando" },
    { id: "reencauchar", label: "Reencauchar" },
    { id: "retirar", label: "Retirar" },
  ],
  items: [
    {
      id: "l1",
      label: "Llanta 1 · direccional izquierda",
      look: "even",
      answer: "rodar",
      facts: [
        { label: "Profundidad", value: "12 mm" },
        { label: "Presión", value: "110 psi" },
      ],
      explanation: "Desgaste parejo y buena profundidad: sigue rodando.",
    },
    {
      id: "l2",
      label: "Llanta 2 · direccional derecha",
      look: "shoulders",
      answer: "reencauchar",
      facts: [
        { label: "Profundidad", value: "4 mm" },
        { label: "Presión", value: "80 psi" },
      ],
      explanation: "Hombros gastados: rodó con baja presión. El casco sirve para reencauchar.",
    },
    {
      id: "l3",
      label: "Llanta 3 · tracción izquierda",
      look: "bulge",
      answer: "retirar",
      facts: [{ label: "Profundidad", value: "9 mm" }],
      explanation: "Un chipote es una ruptura interna: se retira de inmediato.",
    },
    {
      id: "l4",
      label: "Llanta 4 · tracción derecha",
      look: "even",
      answer: "rodar",
      facts: [{ label: "Profundidad", value: "11 mm" }],
      explanation: "Está bien: desgaste uniforme.",
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
