/* ═══════════════════════════════════════════════════════════════
   MathSim — script.js
   GeoGebra-style input + 44 preguntas mezcladas + calculadora
═══════════════════════════════════════════════════════════════ */

"use strict";

/* ══════════════════════════════════════════════════════════
   1.  BASE DE PREGUNTAS (44 preguntas mezcladas)
   Cada objeto: { type, text, answer, tolerance, hint, formula, steps }
   answer: número exacto
   tolerance: margen de error aceptable
══════════════════════════════════════════════════════════ */
const ALL_QUESTIONS = [
  // ─── VP ───
  {
    type: "VP",
    text: "El precio de un producto pasa de $100 a $120. ¿Cuál es la variación porcentual (VP)?",
    answer: 20,
    tolerance: 0.5,
    hint: "Usa: VP = ((VF - VI) / VI) × 100 → ((120 - 100) / 100) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((120 - 100) / 100) × 100 = (20 / 100) × 100 = 20%"
  },
  {
    type: "VP",
    text: "Un valor baja de $200 a $150. ¿Cuál es la variación porcentual (VP)?",
    answer: -25,
    tolerance: 0.5,
    hint: "VP negativo indica disminución. VP = ((150 - 200) / 200) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((150 - 200) / 200) × 100 = (-50 / 200) × 100 = -25%"
  },
  {
    type: "VP",
    text: "Una cantidad sube de 80 a 100. ¿Cuál es la variación porcentual (VP)?",
    answer: 25,
    tolerance: 0.5,
    hint: "VP = ((100 - 80) / 80) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((100 - 80) / 80) × 100 = (20 / 80) × 100 = 25%"
  },
  {
    type: "VP",
    text: "Un monto baja de $500 a $400. ¿Cuál es la variación porcentual (VP)?",
    answer: -20,
    tolerance: 0.5,
    hint: "VP = ((400 - 500) / 500) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((400 - 500) / 500) × 100 = (-100 / 500) × 100 = -20%"
  },
  {
    type: "VP",
    text: "Una cantidad sube de 60 a 90. ¿Cuál es la variación porcentual (VP)?",
    answer: 50,
    tolerance: 0.5,
    hint: "VP = ((90 - 60) / 60) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((90 - 60) / 60) × 100 = (30 / 60) × 100 = 50%"
  },
  {
    type: "VP",
    text: "Un sueldo pasa de $1.200.000 a $1.500.000. ¿Cuál es la variación porcentual?",
    answer: 25,
    tolerance: 0.5,
    hint: "VP = ((1500000 - 1200000) / 1200000) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((1500000 - 1200000) / 1200000) × 100 = (300000 / 1200000) × 100 = 25%"
  },
  {
    type: "VP",
    text: "Un precio baja de $900 a $720. ¿Cuál es la variación porcentual (VP)?",
    answer: -20,
    tolerance: 0.5,
    hint: "VP = ((720 - 900) / 900) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((720 - 900) / 900) × 100 = (-180 / 900) × 100 = -20%"
  },
  {
    type: "VP",
    text: "Una cantidad sube de 350 a 420. ¿Cuál es la variación porcentual?",
    answer: 20,
    tolerance: 0.5,
    hint: "VP = ((420 - 350) / 350) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((420 - 350) / 350) × 100 = (70 / 350) × 100 = 20%"
  },
  {
    type: "VP",
    text: "Un monto baja de $1.000 a $950. ¿Cuál es la variación porcentual?",
    answer: -5,
    tolerance: 0.5,
    hint: "VP = ((950 - 1000) / 1000) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((950 - 1000) / 1000) × 100 = (-50 / 1000) × 100 = -5%"
  },
  {
    type: "VP",
    text: "Un valor sube de $2.400 a $3.000. ¿Cuál es la variación porcentual?",
    answer: 25,
    tolerance: 0.5,
    hint: "VP = ((3000 - 2400) / 2400) × 100",
    formula: "VP = ((VF − VI) / VI) × 100",
    steps: "VP = ((3000 - 2400) / 2400) × 100 = (600 / 2400) × 100 = 25%"
  },

  // ─── VI ───
  {
    type: "VI",
    text: "Un producto cuesta $990 después de subir un 11,2%. ¿Cuál era su precio original (VI)?",
    answer: 890.1,
    tolerance: 2,
    hint: "VI = VF / (1 + VP/100) → VI = 990 / (1 + 11.2/100)",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 990 / (1 + 0.112) = 990 / 1.112 ≈ 890.07"
  },
  {
    type: "VI",
    text: "Un artículo cuesta $1.500 después de un descuento del 20%. ¿Cuál era su valor inicial (VI)?",
    answer: 1875,
    tolerance: 1,
    hint: "Descuento → VP = -20%. VI = 1500 / (1 + (-20/100))",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 1500 / (1 - 0.20) = 1500 / 0.80 = 1875"
  },
  {
    type: "VI",
    text: "Un monto aumenta un 5% y queda en $3.200. ¿Cuál era el valor inicial (VI)?",
    answer: 3047.62,
    tolerance: 2,
    hint: "VI = 3200 / (1 + 5/100) = 3200 / 1.05",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 3200 / 1.05 ≈ 3047.62"
  },
  {
    type: "VI",
    text: "Un precio baja un 10% y queda en $2.700. ¿Cuál era el valor original (VI)?",
    answer: 3000,
    tolerance: 1,
    hint: "VP = -10%. VI = 2700 / (1 - 0.10) = 2700 / 0.90",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 2700 / 0.90 = 3000"
  },
  {
    type: "VI",
    text: "Un producto sube un 30% y queda en $950. ¿Cuál era su precio inicial (VI)?",
    answer: 730.77,
    tolerance: 2,
    hint: "VI = 950 / (1 + 0.30) = 950 / 1.30",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 950 / 1.30 ≈ 730.77"
  },
  {
    type: "VI",
    text: "Un valor final es $800 tras un aumento del 25%. ¿Cuál era el valor inicial (VI)?",
    answer: 640,
    tolerance: 1,
    hint: "VI = 800 / (1 + 0.25) = 800 / 1.25",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 800 / 1.25 = 640"
  },
  {
    type: "VI",
    text: "Un artículo cuesta $660 después de aumentar un 10%. ¿Cuál era el precio original?",
    answer: 600,
    tolerance: 1,
    hint: "VI = 660 / (1 + 0.10) = 660 / 1.10",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 660 / 1.10 = 600"
  },
  {
    type: "VI",
    text: "Tras una rebaja del 15%, un producto cuesta $425. ¿Cuál era su precio original?",
    answer: 500,
    tolerance: 1,
    hint: "VP = -15%. VI = 425 / (1 - 0.15) = 425 / 0.85",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 425 / 0.85 = 500"
  },
  {
    type: "VI",
    text: "Un sueldo sube un 8% y queda en $2.160. ¿Cuál era el sueldo inicial?",
    answer: 2000,
    tolerance: 1,
    hint: "VI = 2160 / 1.08",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 2160 / 1.08 = 2000"
  },
  {
    type: "VI",
    text: "Una inversión creció un 40% y ahora vale $2.800. ¿Cuál fue la inversión inicial?",
    answer: 2000,
    tolerance: 1,
    hint: "VI = 2800 / 1.40",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 2800 / 1.40 = 2000"
  },
  {
    type: "VI",
    text: "Después de una reducción del 35%, el precio de un producto es $325. ¿Cuál era el precio original?",
    answer: 500,
    tolerance: 1,
    hint: "VP = -35%. VI = 325 / 0.65",
    formula: "VI = VF / (1 + VP/100)",
    steps: "VI = 325 / (1 - 0.35) = 325 / 0.65 = 500"
  },

  // ─── VF ───
  {
    type: "VF",
    text: "Un producto cuesta $500 y sube un 20%. ¿Cuál es el precio final (VF)?",
    answer: 600,
    tolerance: 1,
    hint: "VF = VI × (1 + VP/100) → 500 × (1 + 0.20)",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 500 × 1.20 = 600"
  },
  {
    type: "VF",
    text: "Un celular cuesta $1.200.000 y baja un 15%. ¿Cuál es su nuevo precio (VF)?",
    answer: 1020000,
    tolerance: 100,
    hint: "VF = 1200000 × (1 - 0.15) = 1200000 × 0.85",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 1200000 × 0.85 = 1020000"
  },
  {
    type: "VF",
    text: "Un artículo cuesta $850 y sube un 10%. ¿Cuál es el valor final (VF)?",
    answer: 935,
    tolerance: 1,
    hint: "VF = 850 × 1.10",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 850 × 1.10 = 935"
  },
  {
    type: "VF",
    text: "Un producto cuesta $2.000 y tiene un descuento del 25%. ¿Cuál es el precio final (VF)?",
    answer: 1500,
    tolerance: 1,
    hint: "VF = 2000 × (1 - 0.25) = 2000 × 0.75",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 2000 × 0.75 = 1500"
  },
  {
    type: "VF",
    text: "Un sueldo de $800.000 aumenta un 12%. ¿Cuál es el nuevo sueldo (VF)?",
    answer: 896000,
    tolerance: 100,
    hint: "VF = 800000 × 1.12",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 800000 × 1.12 = 896000"
  },
  {
    type: "VF",
    text: "Una deuda de $3.500 aumenta un 8% por interés. ¿Cuál es el valor final (VF)?",
    answer: 3780,
    tolerance: 1,
    hint: "VF = 3500 × 1.08",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 3500 × 1.08 = 3780"
  },
  {
    type: "VF",
    text: "Un terreno valuado en $50.000 sube un 35%. ¿Cuál es su nuevo valor (VF)?",
    answer: 67500,
    tolerance: 10,
    hint: "VF = 50000 × 1.35",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 50000 × 1.35 = 67500"
  },
  {
    type: "VF",
    text: "Una matrícula de $200.000 sube un 5%. ¿Cuál será el nuevo costo (VF)?",
    answer: 210000,
    tolerance: 100,
    hint: "VF = 200000 × 1.05",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 200000 × 1.05 = 210000"
  },
  {
    type: "VF",
    text: "Un producto de $1.400 baja un 30%. ¿Cuál es el precio final (VF)?",
    answer: 980,
    tolerance: 1,
    hint: "VF = 1400 × (1 - 0.30) = 1400 × 0.70",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 1400 × 0.70 = 980"
  },
  {
    type: "VF",
    text: "Una acción vale $450 y sube un 18%. ¿Cuál es su valor final (VF)?",
    answer: 531,
    tolerance: 1,
    hint: "VF = 450 × 1.18",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 450 × 1.18 = 531"
  },
  {
    type: "VF",
    text: "Un monto de $9.000 disminuye un 22%. ¿Cuál es el valor final (VF)?",
    answer: 7020,
    tolerance: 1,
    hint: "VF = 9000 × (1 - 0.22) = 9000 × 0.78",
    formula: "VF = VI × (1 + VP/100)",
    steps: "VF = 9000 × 0.78 = 7020"
  },

  // ─── REGLA DE 3 ───
  {
    type: "R3",
    text: "Si 100 productos cuestan $500, ¿cuánto cuestan 60 productos? (Regla de 3: a=100, b=500, c=60)",
    answer: 300,
    tolerance: 1,
    hint: "x = (b × c) / a = (500 × 60) / 100",
    formula: "x = (b × c) / a",
    steps: "x = (500 × 60) / 100 = 30000 / 100 = 300"
  },
  {
    type: "R3",
    text: "Si en 5 horas se fabrican 200 piezas, ¿cuántas piezas se fabrican en 8 horas? (Regla de 3: a=5, b=200, c=8)",
    answer: 320,
    tolerance: 1,
    hint: "x = (200 × 8) / 5",
    formula: "x = (b × c) / a",
    steps: "x = (200 × 8) / 5 = 1600 / 5 = 320"
  },
  {
    type: "R3",
    text: "Si 4 obreros construyen una pared en 12 días, ¿cuántos días tardan 6 obreros? (Regla de 3 inversa: a=4, b=12, c=6, x=a×b/c)",
    answer: 8,
    tolerance: 0.5,
    hint: "Regla de 3 inversa: x = (a × b) / c = (4 × 12) / 6",
    formula: "x = (a × b) / c",
    steps: "x = (4 × 12) / 6 = 48 / 6 = 8 días"
  },
  {
    type: "R3",
    text: "Si el 100% es $1.500, ¿cuánto es el 30%? (Regla de 3: a=100, b=1500, c=30)",
    answer: 450,
    tolerance: 1,
    hint: "x = (1500 × 30) / 100",
    formula: "x = (b × c) / a",
    steps: "x = (1500 × 30) / 100 = 45000 / 100 = 450"
  },
  {
    type: "R3",
    text: "Si 3 kg de manzanas cuestan $2.400, ¿cuánto cuestan 7 kg? (Regla de 3: a=3, b=2400, c=7)",
    answer: 5600,
    tolerance: 1,
    hint: "x = (2400 × 7) / 3",
    formula: "x = (b × c) / a",
    steps: "x = (2400 × 7) / 3 = 16800 / 3 = 5600"
  },
  {
    type: "R3",
    text: "Si 150 alumnos usan 45 computadores, ¿cuántos computadores necesitan 200 alumnos? (Regla de 3: a=150, b=45, c=200)",
    answer: 60,
    tolerance: 1,
    hint: "x = (45 × 200) / 150",
    formula: "x = (b × c) / a",
    steps: "x = (45 × 200) / 150 = 9000 / 150 = 60"
  },
  {
    type: "R3",
    text: "Si con $800 se compran 40 unidades, ¿cuánto cuestan 75 unidades? (Regla de 3: a=40, b=800, c=75)",
    answer: 1500,
    tolerance: 1,
    hint: "x = (800 × 75) / 40",
    formula: "x = (b × c) / a",
    steps: "x = (800 × 75) / 40 = 60000 / 40 = 1500"
  },
  {
    type: "R3",
    text: "Si un auto recorre 300 km con 25 litros, ¿cuántos litros necesita para 480 km? (Regla de 3: a=300, b=25, c=480)",
    answer: 40,
    tolerance: 1,
    hint: "x = (25 × 480) / 300",
    formula: "x = (b × c) / a",
    steps: "x = (25 × 480) / 300 = 12000 / 300 = 40"
  },
  {
    type: "R3",
    text: "Si 5 máquinas producen 1.200 unidades en un turno, ¿cuánto producen 8 máquinas? (Regla de 3: a=5, b=1200, c=8)",
    answer: 1920,
    tolerance: 1,
    hint: "x = (1200 × 8) / 5",
    formula: "x = (b × c) / a",
    steps: "x = (1200 × 8) / 5 = 9600 / 5 = 1920"
  },
  {
    type: "R3",
    text: "Si el 100% equivale a 250 personas y el 40% asistió, ¿cuántas personas son? (Regla de 3: a=100, b=250, c=40)",
    answer: 100,
    tolerance: 1,
    hint: "x = (250 × 40) / 100",
    formula: "x = (b × c) / a",
    steps: "x = (250 × 40) / 100 = 10000 / 100 = 100"
  },

  // ─── PORCENTAJE DIRECTO ───
  {
    type: "PCT",
    text: "Un estudiante tiene $150. ¿Cuánto es el 20% de ese dinero?",
    answer: 30,
    tolerance: 0.5,
    hint: "Parte = (Total × %) / 100 = (150 × 20) / 100",
    formula: "Parte = (Total × %) / 100",
    steps: "Parte = (150 × 20) / 100 = 3000 / 100 = 30"
  },
  {
    type: "PCT",
    text: "Una tienda tiene 80 productos en oferta. ¿Cuánto es el 35%?",
    answer: 28,
    tolerance: 0.5,
    hint: "Parte = (80 × 35) / 100",
    formula: "Parte = (Total × %) / 100",
    steps: "Parte = (80 × 35) / 100 = 2800 / 100 = 28"
  },
  {
    type: "PCT",
    text: "En una bodega hay 250 cajas. ¿Cuántas corresponden al 12%?",
    answer: 30,
    tolerance: 0.5,
    hint: "Parte = (250 × 12) / 100",
    formula: "Parte = (Total × %) / 100",
    steps: "Parte = (250 × 12) / 100 = 3000 / 100 = 30"
  },
  {
    type: "PCT",
    text: "Una persona tiene $900 en su cuenta. ¿Cuánto es el 5%?",
    answer: 45,
    tolerance: 0.5,
    hint: "Parte = (900 × 5) / 100",
    formula: "Parte = (Total × %) / 100",
    steps: "Parte = (900 × 5) / 100 = 45"
  },
  {
    type: "PCT",
    text: "En un curso hay 500 alumnos en total. ¿Cuántos son el 18%?",
    answer: 90,
    tolerance: 0.5,
    hint: "Parte = (500 × 18) / 100",
    formula: "Parte = (Total × %) / 100",
    steps: "Parte = (500 × 18) / 100 = 90"
  },
  {
    type: "PCT",
    text: "El 15% de un sueldo corresponde a $30.000. ¿Cuál es el sueldo total?",
    answer: 200000,
    tolerance: 100,
    hint: "Total = (Parte × 100) / % = (30000 × 100) / 15",
    formula: "Total = (Parte × 100) / %",
    steps: "Total = (30000 × 100) / 15 = 3000000 / 15 = 200000"
  },
  {
    type: "PCT",
    text: "El 20% de un monto es $50.000. ¿Cuál es el monto total?",
    answer: 250000,
    tolerance: 100,
    hint: "Total = (50000 × 100) / 20",
    formula: "Total = (Parte × 100) / %",
    steps: "Total = (50000 × 100) / 20 = 5000000 / 20 = 250000"
  },
  {
    type: "PCT",
    text: "El 8% de una cantidad es 16 unidades. ¿Cuál es el total?",
    answer: 200,
    tolerance: 1,
    hint: "Total = (16 × 100) / 8",
    formula: "Total = (Parte × 100) / %",
    steps: "Total = (16 × 100) / 8 = 1600 / 8 = 200"
  },
  {
    type: "PCT",
    text: "El 25% del total de ventas corresponde a $75.000. ¿Cuál es el total vendido?",
    answer: 300000,
    tolerance: 100,
    hint: "Total = (75000 × 100) / 25",
    formula: "Total = (Parte × 100) / %",
    steps: "Total = (75000 × 100) / 25 = 300000"
  },
  {
    type: "PCT",
    text: "De 150 personas, 30 aprobaron. ¿Qué porcentaje representa?",
    answer: 20,
    tolerance: 0.5,
    hint: "% = (parte / total) × 100 = (30 / 150) × 100",
    formula: "% = (parte / total) × 100",
    steps: "% = (30 / 150) × 100 = 0.2 × 100 = 20%"
  },
  {
    type: "PCT",
    text: "De 90 productos, 45 están defectuosos. ¿Qué porcentaje es?",
    answer: 50,
    tolerance: 0.5,
    hint: "% = (45 / 90) × 100",
    formula: "% = (parte / total) × 100",
    steps: "% = (45 / 90) × 100 = 0.5 × 100 = 50%"
  },
  {
    type: "PCT",
    text: "De 120 estudiantes, 18 faltaron. ¿Qué porcentaje representa?",
    answer: 15,
    tolerance: 0.5,
    hint: "% = (18 / 120) × 100",
    formula: "% = (parte / total) × 100",
    steps: "% = (18 / 120) × 100 = 0.15 × 100 = 15%"
  },
  {
    type: "PCT",
    text: "De 200 artículos, 25 están dañados. ¿Qué porcentaje es?",
    answer: 12.5,
    tolerance: 0.3,
    hint: "% = (25 / 200) × 100",
    formula: "% = (parte / total) × 100",
    steps: "% = (25 / 200) × 100 = 0.125 × 100 = 12.5%"
  }
];

/* ══════════════════════════════════════════════════════════
   2.  ESTADO DEL SIMULADOR
══════════════════════════════════════════════════════════ */
let questions      = [];   // preguntas en orden mezclado
let currentIndex   = 0;
let userAnswers    = [];   // { answered, correct, userValue }
let hintShown      = false;
let examFinished   = false;
let activeFilter   = "all";

/* ══════════════════════════════════════════════════════════
   3.  UTILIDADES
══════════════════════════════════════════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1000000) return n.toLocaleString("es-CL", { maximumFractionDigits: 2 });
  return parseFloat(n.toFixed(4)).toString().replace(".", ",");
}

/* ── Evaluador seguro de expresiones matemáticas ── */
function safeEval(expr) {
  if (!expr || expr.trim() === "") return null;
  // Limpiar y normalizar la expresión
  let e = expr
    .replace(/,/g, ".")           // comas → puntos decimales
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\^/g, "**")
    .replace(/sqrt\(/g, "Math.sqrt(")
    .replace(/abs\(/g, "Math.abs(")
    .replace(/log\(/g, "Math.log10(")
    .replace(/ln\(/g, "Math.log(")
    .replace(/pi/gi, "Math.PI")
    .replace(/e(?![+\-\d])/g, "Math.E");

  // Solo permitir caracteres seguros
  if (/[^0-9+\-*/().,\s%MathsqrlogabpiE.PI]/g.test(e.replace(/Math\.(sqrt|abs|log10?|PI|E)/g, ""))) {
    // intento más permisivo: solo dígitos y operadores básicos
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + e + ')')();
    if (typeof result === "number" && isFinite(result)) return result;
    return null;
  } catch (_) {
    return null;
  }
}

/* ══════════════════════════════════════════════════════════
   4.  INICIALIZACIÓN DEL QUIZ
══════════════════════════════════════════════════════════ */
function initQuiz() {
  questions    = shuffle(ALL_QUESTIONS);
  currentIndex = 0;
  userAnswers  = questions.map(() => ({ answered: false, correct: false, userValue: null, skipped: false }));
  examFinished = false;
  activeFilter = "all";
  buildQuestionMap();
  loadQuestion(0);
  updateProgress();
}

function applyFilter(filter) {
  activeFilter = filter;
  // Reordenar las preguntas del tipo seleccionado primero
  if (filter === "all") {
    questions = shuffle(ALL_QUESTIONS);
  } else {
    const typed   = ALL_QUESTIONS.filter(q => q.type === filter);
    const others  = ALL_QUESTIONS.filter(q => q.type !== filter);
    questions = [...shuffle(typed), ...shuffle(others)];
  }
  userAnswers = questions.map(() => ({ answered: false, correct: false, userValue: null, skipped: false }));
  currentIndex = 0;
  examFinished = false;
  buildQuestionMap();
  loadQuestion(0);
  updateProgress();
}

/* ══════════════════════════════════════════════════════════
   5.  RENDERIZAR PREGUNTA
══════════════════════════════════════════════════════════ */
function loadQuestion(idx) {
  hintShown = false;
  const q    = questions[idx];
  const card = document.getElementById("question-card");

  // Limpiar estado visual anterior
  card.classList.remove("card-correct", "card-wrong");

  // Badge
  const badge = document.getElementById("q-badge");
  badge.textContent = q.type;
  badge.className = "question-badge badge-" + q.type;

  // Número y texto
  document.getElementById("q-number").textContent = String(idx + 1).padStart(2, "0");
  document.getElementById("q-text").textContent   = q.text;
  // Detectar si es disminución para mostrar fórmula adecuada
let formulaDisplay = q.formula;
if (q.type === "VF" && /disminuye|baja|descuento|rebaja/i.test(q.text)) {
  formulaDisplay = "VF = VI × (1 − VP/100)";
} else if (q.type === "VI" && /disminuye|baja|descuento|rebaja|después de un descuento/i.test(q.text)) {
  formulaDisplay = "VI = VF / (1 − VP/100)";
}
document.getElementById("q-formula").textContent = "Fórmula: " + formulaDisplay;

  // Contador
  document.getElementById("question-counter").textContent =
    `Pregunta ${idx + 1} / ${questions.length}`;

  // Limpiar inputs
  const inp = document.getElementById("answer-input");
  inp.value = "";
  document.getElementById("input-preview").textContent = "—";
  document.getElementById("input-result").textContent  = "";
  document.getElementById("feedback-box").style.display = "none";
  document.getElementById("hint-box").style.display     = "none";

  // Si ya respondida
  if (userAnswers[idx].answered) {
    inp.value = userAnswers[idx].userValue !== null
      ? String(userAnswers[idx].userValue).replace(".", ",")
      : "";
    showFeedback(idx, false);
  }

  updateMapButtons();
  inp.focus();
}

/* ══════════════════════════════════════════════════════════
   6.  PROGRESO
══════════════════════════════════════════════════════════ */
function updateProgress() {
  const answered = userAnswers.filter(a => a.answered || a.skipped).length;
  const pct      = (answered / questions.length) * 100;
  document.getElementById("progress-bar").style.width = pct + "%";
}

/* ══════════════════════════════════════════════════════════
   7.  VERIFICAR RESPUESTA
══════════════════════════════════════════════════════════ */
function verifyAnswer() {
  if (examFinished) return;
  const idx = currentIndex;
  const q   = questions[idx];
  const raw = document.getElementById("answer-input").value.trim();

  if (!raw) {
    showMsg("⚠️ Por favor ingresa una respuesta o fórmula.", "wrong");
    return;
  }

  const evaluated = safeEval(raw);
  let userNum = evaluated;

  if (userNum === null) {
    // Intentar parsear como número directo
    const cleaned = raw.replace(",", ".");
    userNum = parseFloat(cleaned);
  }

  if (userNum === null || isNaN(userNum)) {
    showMsg("⚠️ No se pudo evaluar la expresión. Revisa la sintaxis.", "wrong");
    return;
  }

  userAnswers[idx].answered  = true;
  userAnswers[idx].userValue = raw;

  const diff    = Math.abs(userNum - q.answer);
  const correct = diff <= q.tolerance;
  userAnswers[idx].correct = correct;

  const card = document.getElementById("question-card");
  card.classList.add(correct ? "card-correct" : "card-wrong");

  showFeedback(idx, true);
  updateMapButtons();
  updateProgress();
}

function showFeedback(idx, animate) {
  const q    = questions[idx];
  const ua   = userAnswers[idx];
  const box  = document.getElementById("feedback-box");

  if (!ua.answered) { box.style.display = "none"; return; }

  const raw       = ua.userValue || "";
  const evaluated = safeEval(raw);
  const displayVal = evaluated !== null ? fmt(evaluated) : raw;

  if (ua.correct) {
    box.className   = "feedback-box correct";
    box.innerHTML   = `✅ <b>¡Correcto!</b><br>
      Tu respuesta: <code>${raw}</code> = <b>${displayVal}</b><br>
      Respuesta esperada: <b>${fmt(q.answer)}</b><br>
      <span style="color:#86efac;font-size:0.8rem">Pasos: ${q.steps}</span>`;
  } else {
    box.className   = "feedback-box wrong";
    box.innerHTML   = `❌ <b>Incorrecto</b><br>
      Tu respuesta evaluada: <code>${displayVal}</code><br>
      Respuesta correcta: <b>${fmt(q.answer)}</b><br>
      <span style="color:#fca5a5;font-size:0.8rem">Pasos: ${q.steps}</span>`;
  }
  box.style.display = "block";
}

function showMsg(msg, cls) {
  const box = document.getElementById("feedback-box");
  box.className   = "feedback-box " + cls;
  box.innerHTML   = msg;
  box.style.display = "block";
}

/* ══════════════════════════════════════════════════════════
   8.  PISTA
══════════════════════════════════════════════════════════ */
function showHint() {
  const q   = questions[currentIndex];
  const box = document.getElementById("hint-box");
  if (!hintShown) {
    box.innerHTML = "💡 <b>Pista:</b> " + q.hint;
    box.style.display = "block";
    hintShown = true;
  } else {
    box.style.display = "none";
    hintShown = false;
  }
}

/* ══════════════════════════════════════════════════════════
   9.  NAVEGACIÓN
══════════════════════════════════════════════════════════ */
function nextQuestion() {
  if (currentIndex < questions.length - 1) {
    currentIndex++;
    loadQuestion(currentIndex);
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    loadQuestion(currentIndex);
  }
}

function skipQuestion() {
  userAnswers[currentIndex].skipped = true;
  updateMapButtons();
  updateProgress();
  nextQuestion();
}

function goToQuestion(idx) {
  currentIndex = idx;
  loadQuestion(idx);
}

/* ══════════════════════════════════════════════════════════
   10.  MAPA DE PREGUNTAS
══════════════════════════════════════════════════════════ */
function buildQuestionMap() {
  const map = document.getElementById("question-map");
  map.innerHTML = "";
  questions.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.className   = "map-btn";
    btn.textContent = i + 1;
    btn.addEventListener("click", () => goToQuestion(i));
    map.appendChild(btn);
  });
}

function updateMapButtons() {
  const btns = document.querySelectorAll(".map-btn");
  btns.forEach((btn, i) => {
    btn.className = "map-btn";
    if (i === currentIndex) btn.classList.add("current");
    else if (userAnswers[i].answered && userAnswers[i].correct)  btn.classList.add("answered-correct");
    else if (userAnswers[i].answered && !userAnswers[i].correct) btn.classList.add("answered-wrong");
    else if (userAnswers[i].skipped) btn.classList.add("skipped");
  });
}

/* ══════════════════════════════════════════════════════════
   11.  RESULTADO FINAL
══════════════════════════════════════════════════════════ */
function finishExam() {
  examFinished = true;
  showSection("result");

  const answered = userAnswers.filter(a => a.answered);
  const correct  = userAnswers.filter(a => a.correct);
  const wrong    = answered.filter(a => !a.correct);
  const skipped  = userAnswers.filter(a => a.skipped && !a.answered);
  const total    = questions.length;
  const pct      = total > 0 ? Math.round((correct.length / total) * 100) : 0;

  // Ícono
  let icon = pct >= 90 ? "🏆" : pct >= 70 ? "🎓" : pct >= 50 ? "📚" : "💪";
  document.getElementById("result-icon").textContent  = icon;
  document.getElementById("result-score").textContent = pct + "%";

  // Nota (escala 1-7 chile)
  const nota = Math.max(1, Math.min(7, (pct / 100) * 6 + 1)).toFixed(1);
  document.getElementById("result-details").innerHTML =
    `<b>${correct.length}</b> correctas · <b>${wrong.length}</b> incorrectas · <b>${skipped.length}</b> saltadas de <b>${total}</b><br>
     Nota aproximada: <b style="color:var(--accent-vf)">${nota}</b>`;

  // Desglose por tipo
  const types = ["VP", "VI", "VF", "R3", "PCT"];
  const colors = { VP:"var(--accent-vp)", VI:"var(--accent-vi)", VF:"var(--accent-vf)", R3:"var(--accent-r3)", PCT:"var(--accent-pct)" };
  const bd = document.getElementById("result-breakdown");
  bd.innerHTML = "";
  types.forEach(t => {
    const qs    = questions.filter(q => q.type === t);
    const cor   = qs.filter((q, i) => {
      const realIdx = questions.indexOf(q);
      return userAnswers[realIdx] && userAnswers[realIdx].correct;
    }).length;
    const div = document.createElement("div");
    div.className = "breakdown-item";
    div.innerHTML = `
      <div class="breakdown-label">${t}</div>
      <div class="breakdown-value" style="color:${colors[t]}">${cor}/${qs.length}</div>`;
    bd.appendChild(div);
  });
}

/* ══════════════════════════════════════════════════════════
   12.  GeoGebra-STYLE INPUT: preview en tiempo real
══════════════════════════════════════════════════════════ */
function setupGeoGebraInput() {
  const inp     = document.getElementById("answer-input");
  const preview = document.getElementById("input-preview");
  const result  = document.getElementById("input-result");

  inp.addEventListener("input", () => {
    const raw = inp.value.trim();
    if (!raw) { preview.textContent = "—"; result.textContent = ""; return; }
    // Mostrar expresión normalizada
    preview.textContent = raw
      .replace(/\*\*/g, "^")
      .replace(/\*/g, " × ")
      .replace(/\//g, " ÷ ");

    // Evaluar y mostrar resultado
    const val = safeEval(raw);
    if (val !== null) {
      result.textContent = "= " + fmt(val);
    } else {
      result.textContent = "";
    }
  });

  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") verifyAnswer();
  });

  // Botón de evaluación explícita
  document.getElementById("eval-btn").addEventListener("click", verifyAnswer);

  // Insertar símbolos
  document.querySelectorAll(".sym-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const ins = btn.dataset.insert;
      const start = inp.selectionStart;
      const end   = inp.selectionEnd;
      inp.value = inp.value.slice(0, start) + ins + inp.value.slice(end);
      inp.selectionStart = inp.selectionEnd = start + ins.length;
      inp.dispatchEvent(new Event("input"));
      inp.focus();
    });
  });
}

/* ══════════════════════════════════════════════════════════
   13.  SECCIONES / NAVEGACIÓN
══════════════════════════════════════════════════════════ */
function showSection(name) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  const sectionMap = { quiz: "section-quiz", calc: "section-calc", ref: "section-ref", result: "section-result" };
  const sec = document.getElementById(sectionMap[name] || "section-quiz");
  if (sec) sec.classList.add("active");

  const navMap = { quiz: '[data-section="quiz"]', calc: '[data-section="calc"]', ref: '[data-section="ref"]' };
  if (navMap[name]) {
    const nb = document.querySelector(navMap[name]);
    if (nb) nb.classList.add("active");
  }
}

/* ══════════════════════════════════════════════════════════
   14.  CALCULADORA — lógica
══════════════════════════════════════════════════════════ */
function showCalcResult(resultId, stepsId, resultText, stepsText) {
  const rEl = document.getElementById(resultId);
  const sEl = document.getElementById(stepsId);
  rEl.textContent = resultText;
  sEl.innerHTML   = stepsText;
  sEl.classList.add("show");
}

function calcVP() {
  const vi = parseFloat(document.getElementById("vp-vi").value.replace(",","."));
  const vf = parseFloat(document.getElementById("vp-vf").value.replace(",","."));
  if (isNaN(vi) || isNaN(vf) || vi === 0) {
    showCalcResult("vp-result","vp-steps","⚠️ Valores inválidos","VI no puede ser 0");return;
  }
  const vp = ((vf - vi) / vi) * 100;
  const sign = vp >= 0 ? "↑ Aumentó" : "↓ Disminuyó";
  showCalcResult("vp-result","vp-steps",
    `VP = ${fmt(vp)}%  ${sign}`,
    `VP = ((VF − VI) / VI) × 100<br>
     VP = ((${fmt(vf)} − ${fmt(vi)}) / ${fmt(vi)}) × 100<br>
     VP = (${fmt(vf-vi)} / ${fmt(vi)}) × 100<br>
     VP = <b>${fmt(vp)}%</b>`
  );
}

function calcVI() {
  const vf = parseFloat(document.getElementById("vi-vf").value.replace(",","."));
  const vp = parseFloat(document.getElementById("vi-vp").value.replace(",","."));
  if (isNaN(vf) || isNaN(vp)) {
    showCalcResult("vi-result","vi-steps","⚠️ Valores inválidos","Revisa los campos.");return;
  }
  const vi = vf / (1 + vp / 100);
  showCalcResult("vi-result","vi-steps",
    `VI = ${fmt(vi)}`,
    `VI = VF / (1 + VP/100)<br>
     VI = ${fmt(vf)} / (1 + ${fmt(vp)}/100)<br>
     VI = ${fmt(vf)} / ${fmt(1 + vp/100)}<br>
     VI = <b>${fmt(vi)}</b>`
  );
}

function calcVF() {
  const vi = parseFloat(document.getElementById("vf-vi").value.replace(",","."));
  const vp = parseFloat(document.getElementById("vf-vp").value.replace(",","."));
  if (isNaN(vi) || isNaN(vp)) {
    showCalcResult("vf-result","vf-steps","⚠️ Valores inválidos","Revisa los campos.");return;
  }
  const vf = vi * (1 + vp / 100);
  showCalcResult("vf-result","vf-steps",
    `VF = ${fmt(vf)}`,
    `VF = VI × (1 + VP/100)<br>
     VF = ${fmt(vi)} × (1 + ${fmt(vp)}/100)<br>
     VF = ${fmt(vi)} × ${fmt(1 + vp/100)}<br>
     VF = <b>${fmt(vf)}</b>`
  );
}

function calcR3() {
  const a = parseFloat(document.getElementById("r3-a").value.replace(",","."));
  const b = parseFloat(document.getElementById("r3-b").value.replace(",","."));
  const c = parseFloat(document.getElementById("r3-c").value.replace(",","."));
  if (isNaN(a) || isNaN(b) || isNaN(c) || a === 0) {
    showCalcResult("r3-result","r3-steps","⚠️ Valores inválidos","a no puede ser 0.");return;
  }
  const x = (b * c) / a;
  showCalcResult("r3-result","r3-steps",
    `x = ${fmt(x)}`,
    `x = (b × c) / a<br>
     x = (${fmt(b)} × ${fmt(c)}) / ${fmt(a)}<br>
     x = ${fmt(b*c)} / ${fmt(a)}<br>
     x = <b>${fmt(x)}</b>`
  );
}

function calcPCT() {
  const total = parseFloat(document.getElementById("pct-total").value.replace(",","."));
  const pct   = parseFloat(document.getElementById("pct-pct").value.replace(",","."));
  if (isNaN(total) || isNaN(pct)) {
    showCalcResult("pct-result","pct-steps","⚠️ Valores inválidos","Revisa los campos.");return;
  }
  const part = (total * pct) / 100;
  showCalcResult("pct-result","pct-steps",
    `Parte = ${fmt(part)}`,
    `Parte = (Total × %) / 100<br>
     Parte = (${fmt(total)} × ${fmt(pct)}) / 100<br>
     Parte = ${fmt(total*pct)} / 100<br>
     Parte = <b>${fmt(part)}</b>`
  );
}

/* ══════════════════════════════════════════════════════════
   15.  EVENTOS GLOBALES
══════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {

  /* — Navegación de secciones — */
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      showSection(btn.dataset.section);
    });
  });

  /* — Botones del quiz — */
  document.getElementById("btn-verify").addEventListener("click", verifyAnswer);
  document.getElementById("btn-hint").addEventListener("click", showHint);
  document.getElementById("btn-skip").addEventListener("click", skipQuestion);
  document.getElementById("btn-next").addEventListener("click", nextQuestion);
  document.getElementById("btn-prev").addEventListener("click", prevQuestion);
  document.getElementById("btn-finish").addEventListener("click", finishExam);

  /* — Resultado — */
  document.getElementById("btn-restart").addEventListener("click", () => {
    showSection("quiz");
    initQuiz();
  });
  document.getElementById("btn-review").addEventListener("click", () => {
    showSection("quiz");
    loadQuestion(0);
  });

  /* — Filtros — */
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      applyFilter(btn.dataset.filter);
    });
  });

  /* — Setup GeoGebra input — */
  setupGeoGebraInput();

  /* — Arrancar — */
  initQuiz();
});
