const CURVE_POINTS = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
const SEGMENTS = [
  { from: -Infinity, to: -2.5, percent: 0.5 },
  { from: -2.5, to: -2, percent: 1.5 },
  { from: -2, to: -1.5, percent: 5 },
  { from: -1.5, to: -1, percent: 9 },
  { from: -1, to: -0.5, percent: 15 },
  { from: -0.5, to: 0, percent: 19 },
  { from: 0, to: 0.5, percent: 19 },
  { from: 0.5, to: 1, percent: 15 },
  { from: 1, to: 1.5, percent: 9 },
  { from: 1.5, to: 2, percent: 5 },
  { from: 2, to: 2.5, percent: 1.5 },
  { from: 2.5, to: Infinity, percent: 0.5 },
];

const CUMULATIVE = new Map([
  [-2.5, 0.5],
  [-2, 2],
  [-1.5, 7],
  [-1, 16],
  [-0.5, 31],
  [0, 50],
  [0.5, 69],
  [1, 84],
  [1.5, 93],
  [2, 98],
  [2.5, 99.5],
]);

const STAGES = {
  map: {
    kicker: "שלב 1",
    title: "מפת הפעמון",
    skill: "אחוזים",
    generators: ["percent"],
  },
  z: {
    kicker: "שלב 2",
    title: "מכונת Z",
    skill: "ציון תקן",
    generators: ["z"],
  },
  x: {
    kicker: "שלב 3",
    title: "מציאת נתון",
    skill: "חישוב הפוך",
    generators: ["x", "mean", "sigma"],
  },
  boss: {
    kicker: "שלב 4",
    title: "גמר האלופות",
    skill: "מעורב",
    generators: ["percent", "z", "x", "mean", "sigma", "count"],
  },
};

const SCENARIOS = [
  {
    badge: "ליגת האלופות",
    title: "משחקי ליגת האלופות",
    itemPlural: "המשחקים",
    populationLabel: "משחקים",
    metric: "מספר בעיטות למסגרת",
    unit: "בעיטות",
    meanOptions: [8, 9, 10, 12],
    sigmaOptions: [1.6, 2, 2.4, 3],
    populationOptions: [80, 100, 120, 160],
  },
  {
    badge: "מסי",
    title: "משחקי אינטר מיאמי של מסי",
    itemPlural: "המשחקים",
    populationLabel: "משחקים",
    metric: "מספר מסירות מפתח",
    unit: "מסירות",
    meanOptions: [4, 5, 6, 7],
    sigmaOptions: [0.8, 1, 1.2],
    populationOptions: [30, 40, 50, 60],
  },
  {
    badge: "פריז",
    title: "אוהדי פריז בגמר ליגת האלופות",
    itemPlural: "האוהדים",
    populationLabel: "אוהדים",
    metric: "זמן כניסה לאצטדיון",
    unit: "דקות",
    meanOptions: [45, 50, 55, 60],
    sigmaOptions: [6, 8, 10],
    populationOptions: [200, 500, 800, 1200],
  },
  {
    badge: "שוערים",
    title: "שוערי טורניר כדורגל",
    itemPlural: "השוערים",
    populationLabel: "שוערים",
    metric: "מספר הצלות במשחק",
    unit: "הצלות",
    meanOptions: [3, 4, 5],
    sigmaOptions: [0.6, 0.8, 1],
    populationOptions: [24, 32, 48, 64],
  },
];

const state = {
  stage: "map",
  question: null,
  selectedAnswer: null,
  answered: false,
  stats: loadStats(),
};

const els = {
  score: document.querySelector("#scoreValue"),
  streak: document.querySelector("#streakValue"),
  accuracy: document.querySelector("#accuracyValue"),
  stageKicker: document.querySelector("#stageKicker"),
  stageTitle: document.querySelector("#stageTitle"),
  scenarioBadge: document.querySelector("#scenarioBadge"),
  skillBadge: document.querySelector("#skillBadge"),
  questionText: document.querySelector("#questionText"),
  questionData: document.querySelector("#questionData"),
  answerArea: document.querySelector("#answerArea"),
  feedbackBox: document.querySelector("#feedbackBox"),
  bellGraph: document.querySelector("#bellGraph"),
  hintButton: document.querySelector("#hintButton"),
  checkButton: document.querySelector("#checkButton"),
  nextButton: document.querySelector("#nextButton"),
  resetButton: document.querySelector("#resetButton"),
};

function loadStats() {
  const empty = { score: 0, streak: 0, correct: 0, answered: 0 };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem("bellCurveStats")) };
  } catch {
    return empty;
  }
}

function saveStats() {
  localStorage.setItem("bellCurveStats", JSON.stringify(state.stats));
}

function randItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function fmt(value) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/\.?0+$/, "");
}

function numHtml(value) {
  return `<bdi dir="ltr">${fmt(value)}</bdi>`;
}

function percentHtml(value) {
  return `<bdi dir="ltr">${fmt(value)}%</bdi>`;
}

function percentText(value) {
  return `${fmt(value)}%`;
}

function chooseScenario() {
  const scenario = randItem(SCENARIOS);
  const mu = randItem(scenario.meanOptions);
  const sigma = randItem(scenario.sigmaOptions);
  return { ...scenario, mu, sigma };
}

function valueAt(mu, sigma, z) {
  return Math.round((mu + sigma * z) * 100) / 100;
}

function cumulativeAt(z) {
  return CUMULATIVE.get(z);
}

function percentForDirection(z, direction) {
  const less = cumulativeAt(z);
  return direction === "less" ? less : 100 - less;
}

function makeChoices(answer, unit, kind = "percent") {
  const offsets = kind === "percent" ? [-15, -9, -5, 5, 9, 15] : [-12, -6, -3, 3, 6, 12];
  const values = new Set([fmt(answer)]);
  for (const offset of shuffle(offsets)) {
    if (values.size >= 4) break;
    const raw = Math.round((answer + offset) * 10) / 10;
    const candidate = kind === "percent" ? Math.min(100, Math.max(0, raw)) : Math.max(0, raw);
    if (candidate !== answer) values.add(fmt(candidate));
  }
  return shuffle([...values]).map((value) => ({
    value: Number(value),
    label: kind === "percent" ? `${value}%` : `${value} ${unit}`,
  }));
}

function makePercentQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]);
  const direction = randItem(["less", "more"]);
  const x = valueAt(scenario.mu, scenario.sigma, z);
  const answer = percentForDirection(z, direction);
  const side = direction === "less" ? "מתחת ל־" : "מעל ";
  const areaSide = direction === "less" ? "משמאל" : "מימין";

  return {
    type: "choice",
    graphMode: "area",
    stageSkill: "אחוזים",
    scenario,
    z,
    direction,
    x,
    answer,
    tolerance: 0.01,
    unit: "%",
    choices: makeChoices(answer, "%", "percent"),
    text: `מהו האחוז מתוך ${scenario.itemPlural} עם ${scenario.metric} ${side}${numHtml(x)} בהתפלגות של ${scenario.title}?`,
    data: `ממוצע μ=${numHtml(scenario.mu)}, סטיית תקן σ=${numHtml(scenario.sigma)}.`,
    hint: `הערך ${numHtml(x)} נמצא ב־Z=${numHtml(z)}. עכשיו סופרים את האחוזים ${areaSide} לקו הזה.`,
    explanation: `Z=${numHtml(z)}, ולכן ${side}${numHtml(x)} הם ${percentHtml(answer)} לפי גרף האחוזים.`,
  };
}

function makeZQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-2, -1.5, -1, -0.5, -0.25, 0.5, 1, 1.5, 2]);
  const x = valueAt(scenario.mu, scenario.sigma, z);

  return {
    type: "number",
    graphMode: "marker",
    stageSkill: "ציון תקן",
    scenario,
    z,
    x,
    answer: z,
    tolerance: 0.01,
    inputLabel: "ציון התקן Z",
    text: `כאשר ${scenario.metric} הוא ${numHtml(x)}, מה ציון התקן?`,
    data: `ממוצע μ=${numHtml(scenario.mu)}, סטיית תקן σ=${numHtml(scenario.sigma)}.`,
    hint: `מציבים בנוסחה: <span class="formula">Z=(X-μ)/σ</span>. קודם בודקים אם ${numHtml(x)} מעל או מתחת לממוצע.`,
    explanation: `<span class="formula">Z=(${fmt(x)}-${fmt(scenario.mu)})/${fmt(scenario.sigma)}=${fmt(z)}</span>.`,
  };
}

function makeXQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-2, -1.5, -1, -0.5, -0.25, 0.25, 0.5, 1, 1.5, 2]);
  const answer = valueAt(scenario.mu, scenario.sigma, z);

  return {
    type: "number",
    graphMode: "marker",
    stageSkill: "חישוב X",
    scenario,
    z,
    x: answer,
    answer,
    tolerance: 0.05,
    unit: ` ${scenario.unit}`,
    inputLabel: `${scenario.metric}`,
    text: `כאשר ציון התקן הוא Z=${numHtml(z)}, מה הערך?`,
    data: `ממוצע μ=${numHtml(scenario.mu)}, סטיית תקן σ=${numHtml(scenario.sigma)}.`,
    hint: `משתמשים בצורה ההפוכה: <span class="formula">X=μ+Z·σ</span>.`,
    explanation: `<span class="formula">X=${fmt(scenario.mu)}+${fmt(z)}·${fmt(scenario.sigma)}=${fmt(answer)}</span>.`,
  };
}

function makeMeanQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-1.5, -1, -0.5, 0.5, 1, 1.5]);
  const x = valueAt(scenario.mu, scenario.sigma, z);
  const direction = z < 0 ? "less" : "more";
  const percent = percentForDirection(z, direction);
  const side = direction === "less" ? "מתחת ל־" : "מעל ";

  return {
    type: "number",
    graphMode: "area",
    stageSkill: "מציאת μ",
    scenario,
    z,
    direction,
    x,
    answer: scenario.mu,
    tolerance: 0.05,
    unit: ` ${scenario.unit}`,
    inputLabel: "הממוצע μ",
    text: `ידוע ש־${percentHtml(percent)} מתוך ${scenario.itemPlural} הם עם ${scenario.metric} ${side}${numHtml(x)}. מה הממוצע?`,
    data: `סטיית תקן σ=${numHtml(scenario.sigma)}.`,
    hint: `האחוז ${percentHtml(percent)} מציב את ${numHtml(x)} בקו Z=${numHtml(z)}. לכן <span class="formula">μ=X−Z·σ</span>.`,
    explanation: `<span class="formula">μ=${fmt(x)}-${fmt(z)}·${fmt(scenario.sigma)}=${fmt(scenario.mu)}</span>.`,
  };
}

function makeSigmaQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-2, -1.5, -1, 1, 1.5, 2]);
  const x = valueAt(scenario.mu, scenario.sigma, z);
  const direction = z < 0 ? "less" : "more";
  const percent = percentForDirection(z, direction);
  const side = direction === "less" ? "מתחת ל־" : "מעל ";

  return {
    type: "number",
    graphMode: "area",
    stageSkill: "מציאת σ",
    scenario,
    z,
    direction,
    x,
    answer: scenario.sigma,
    tolerance: 0.05,
    unit: ` ${scenario.unit}`,
    inputLabel: "סטיית התקן σ",
    text: `ידוע ש־${percentHtml(percent)} מתוך ${scenario.itemPlural} הם עם ${scenario.metric} ${side}${numHtml(x)}. מה סטיית התקן?`,
    data: `ממוצע μ=${numHtml(scenario.mu)}.`,
    hint: `האחוז קובע ש־Z=${numHtml(z)}. מציבים: <span class="formula">Z=(X-μ)/σ</span> ואז מבודדים את σ.`,
    explanation: `<span class="formula">σ=(${fmt(x)}-${fmt(scenario.mu)})/${fmt(z)}=${fmt(scenario.sigma)}</span>.`,
  };
}

function makeCountQuestion() {
  const scenario = chooseScenario();
  const z = randItem([-1.5, -1, -0.5, 0.5, 1, 1.5, 2]);
  const direction = randItem(["less", "more"]);
  const x = valueAt(scenario.mu, scenario.sigma, z);
  const percent = percentForDirection(z, direction);
  const population = randItem(scenario.populationOptions);
  const answer = Math.round((percent / 100) * population);
  const side = direction === "less" ? "מתחת ל־" : "מעל ";

  return {
    type: "number",
    graphMode: "area",
    stageSkill: "כמות מתוך אחוז",
    scenario,
    z,
    direction,
    x,
    answer,
    tolerance: 0.05,
    unit: ` ${scenario.populationLabel}`,
    inputLabel: `מספר ${scenario.itemPlural}`,
    text: `כמה מתוך ${numHtml(population)} ${scenario.populationLabel} הם עם ${scenario.metric} ${side}${numHtml(x)}?`,
    data: `ממוצע μ=${numHtml(scenario.mu)}, סטיית תקן σ=${numHtml(scenario.sigma)}.`,
    hint: `קודם מוצאים את האחוז לפי Z=${numHtml(z)}, ואז מחשבים ${percentHtml(percent)} מתוך ${numHtml(population)}.`,
    explanation: `${side}${numHtml(x)} הם ${percentHtml(percent)}. לכן <span class="formula">${fmt(percent)}/100·${population}=${fmt(answer)}</span>.`,
  };
}

const GENERATORS = {
  percent: makePercentQuestion,
  z: makeZQuestion,
  x: makeXQuestion,
  mean: makeMeanQuestion,
  sigma: makeSigmaQuestion,
  count: makeCountQuestion,
};

function newQuestion() {
  const generatorName = randItem(STAGES[state.stage].generators);
  state.question = GENERATORS[generatorName]();
  state.selectedAnswer = null;
  state.answered = false;
  render();
}

function render() {
  const stage = STAGES[state.stage];
  els.stageKicker.textContent = stage.kicker;
  els.stageTitle.textContent = stage.title;
  els.scenarioBadge.textContent = state.question.scenario.badge;
  els.skillBadge.textContent = state.question.stageSkill;
  els.questionText.innerHTML = state.question.text;
  els.questionData.innerHTML = state.question.data;
  els.feedbackBox.className = "feedback-box";
  els.feedbackBox.textContent = "בחרו תשובה או הקלידו מספר, ואז בדקו.";
  els.checkButton.classList.remove("hidden");
  els.nextButton.classList.add("hidden");
  renderStats();
  renderTabs();
  renderAnswer();
  renderBellGraph();
}

function renderStats() {
  const accuracy = state.stats.answered
    ? Math.round((state.stats.correct / state.stats.answered) * 100)
    : 0;
  els.score.textContent = state.stats.score;
  els.streak.textContent = state.stats.streak;
  els.accuracy.textContent = `${accuracy}%`;
}

function renderTabs() {
  document.querySelectorAll(".stage-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.stage === state.stage);
  });
}

function renderAnswer() {
  els.answerArea.innerHTML = "";

  if (state.question.type === "choice") {
    const grid = document.createElement("div");
    grid.className = "choice-grid";
    state.question.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-button";
      button.textContent = choice.label;
      button.dataset.value = choice.value;
      button.addEventListener("click", () => {
        if (state.answered) return;
        state.selectedAnswer = choice.value;
        document.querySelectorAll(".choice-button").forEach((item) => {
          item.classList.toggle("selected", item === button);
        });
      });
      grid.appendChild(button);
    });
    els.answerArea.appendChild(grid);
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "numeric-answer";
  wrapper.innerHTML = `
    <label for="numericInput">${state.question.inputLabel}</label>
    <input id="numericInput" type="number" inputmode="decimal" step="0.01" autocomplete="off" />
  `;
  els.answerArea.appendChild(wrapper);
  wrapper.querySelector("input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkAnswer();
  });
}

function setFeedback(mode, message) {
  els.feedbackBox.className = `feedback-box ${mode}`;
  els.feedbackBox.innerHTML = message;
}

function checkAnswer() {
  if (state.answered) {
    newQuestion();
    return;
  }

  const question = state.question;
  const raw =
    question.type === "choice"
      ? state.selectedAnswer
      : readNumericAnswer();

  if (raw === null || raw === undefined || Number.isNaN(raw)) {
    setFeedback("hint", "עוד לא נבחרה תשובה.");
    return;
  }

  const isCorrect = Math.abs(Number(raw) - question.answer) <= question.tolerance;
  state.answered = true;
  state.stats.answered += 1;
  if (isCorrect) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.stats.score += 10 + Math.min(state.stats.streak, 5) * 2;
    setFeedback("correct", `נכון. ${question.explanation}`);
  } else {
    state.stats.streak = 0;
    setFeedback("wrong", `לא בדיוק. התשובה היא ${fmt(question.answer)}${question.unit || ""}. ${question.explanation}`);
  }
  saveStats();
  renderStats();
  lockAnswerButtons(isCorrect);
  els.checkButton.classList.add("hidden");
  els.nextButton.classList.remove("hidden");
}

function readNumericAnswer() {
  const input = document.querySelector("#numericInput");
  if (!input || !input.value.trim()) return null;
  return Number(input.value);
}

function lockAnswerButtons(isCorrect) {
  if (state.question.type !== "choice") return;
  document.querySelectorAll(".choice-button").forEach((button) => {
    const value = Number(button.dataset.value);
    button.disabled = true;
    if (Math.abs(value - state.question.answer) <= state.question.tolerance) {
      button.classList.add("correct");
    } else if (!isCorrect && value === state.selectedAnswer) {
      button.classList.add("wrong");
    }
  });
}

function showHint() {
  setFeedback("hint", state.question.hint);
}

function zToX(z) {
  const min = -2.7;
  const max = 2.7;
  return 46 + ((z - min) / (max - min)) * 668;
}

function yForZ(z) {
  const density = Math.exp(-(z * z) / 2);
  return 280 - density * 210;
}

function makeCurvePath() {
  const points = [];
  for (let z = -2.7; z <= 2.701; z += 0.05) {
    points.push(`${zToX(z).toFixed(2)},${yForZ(z).toFixed(2)}`);
  }
  return `M ${points.join(" L ")}`;
}

function makeAreaPath(fromZ, toZ) {
  const from = Math.max(fromZ, -2.7);
  const to = Math.min(toZ, 2.7);
  const points = [];
  for (let z = from; z <= to + 0.001; z += 0.05) {
    points.push(`${zToX(z).toFixed(2)},${yForZ(z).toFixed(2)}`);
  }
  return `M ${zToX(from)},280 L ${points.join(" L ")} L ${zToX(to)},280 Z`;
}

function labelForPoint(z, question) {
  const value = valueAt(question.scenario.mu, question.scenario.sigma, z);
  return fmt(value);
}

function segmentMid(from, to) {
  if (!Number.isFinite(from)) return -2.6;
  if (!Number.isFinite(to)) return 2.6;
  return (from + to) / 2;
}

function isSegmentSelected(segment, question) {
  if (question.graphMode !== "area") return false;
  if (question.direction === "less") return segment.to <= question.z;
  return segment.from >= question.z;
}

function renderBellGraph() {
  const question = state.question;
  const areaFrom = question.direction === "less" ? -2.7 : question.z;
  const areaTo = question.direction === "less" ? question.z : 2.7;
  const areaPath = question.graphMode === "area" ? makeAreaPath(areaFrom, areaTo) : "";
  const markerX = zToX(question.z || 0);
  const markerY = yForZ(question.z || 0);
  const centerArea = makeAreaPath(-0.5, 0.5);

  const segmentLabels = SEGMENTS.map((segment) => {
    const z = segmentMid(segment.from, segment.to);
    const selected = isSegmentSelected(segment, question);
    return `
      <text class="graph-small" x="${zToX(z)}" y="304" text-anchor="middle" fill="${selected ? "#9b6307" : "#5a6870"}">${percentText(segment.percent)}</text>
    `;
  }).join("");

  const pointLabels = CURVE_POINTS.map((z) => {
    const x = zToX(z);
    const label = labelForPoint(z, question);
    const isMain = z === 0;
    return `
      <line x1="${x}" y1="76" x2="${x}" y2="280" stroke="${isMain ? "#0f766e" : "#c9d4cf"}" stroke-width="${isMain ? 2 : 1}" stroke-dasharray="${isMain ? "0" : "4 4"}" />
      <text class="graph-label" x="${x}" y="296" text-anchor="middle">${label}</text>
      <text class="graph-small" x="${x}" y="320" text-anchor="middle">Z=${fmt(z)}</text>
    `;
  }).join("");

  els.bellGraph.innerHTML = `
    <svg viewBox="0 0 760 335" role="img" aria-label="עקומת פעמון עם ממוצע, סטיות תקן ואחוזים">
      <rect x="0" y="0" width="760" height="335" fill="#fbfdfb" />
      <path d="${centerArea}" fill="#dff2ec" />
      ${areaPath ? `<path d="${areaPath}" fill="#fff2d7" />` : ""}
      ${pointLabels}
      <line x1="34" y1="280" x2="726" y2="280" stroke="#6b767d" stroke-width="2" />
      <path d="${makeCurvePath()}" fill="none" stroke="#172026" stroke-width="4" stroke-linecap="round" />
      <circle cx="${markerX}" cy="${markerY}" r="7" fill="#d95f4b" stroke="#ffffff" stroke-width="3" />
      <line x1="${markerX}" y1="${markerY + 8}" x2="${markerX}" y2="280" stroke="#d95f4b" stroke-width="3" />
      ${segmentLabels}
      <text class="graph-label" x="${zToX(0)}" y="52" text-anchor="middle">μ=${fmt(question.scenario.mu)}</text>
      <text class="graph-small" x="${zToX(1.58)}" y="52" text-anchor="middle">σ=${fmt(question.scenario.sigma)}</text>
    </svg>
  `;
}

document.querySelectorAll(".stage-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.stage = tab.dataset.stage;
    newQuestion();
  });
});

els.checkButton.addEventListener("click", checkAnswer);
els.nextButton.addEventListener("click", newQuestion);
els.hintButton.addEventListener("click", showHint);
els.resetButton.addEventListener("click", () => {
  state.stats = { score: 0, streak: 0, correct: 0, answered: 0 };
  saveStats();
  renderStats();
  setFeedback("hint", "ההתקדמות אופסה.");
});

newQuestion();
