export const POLL_INTERVAL_MS = 300_000;

const FIRESTORE_URL = "https://firestore.googleapis.com/v1/projects/btc-dashboard-9307b/databases/(default)/documents/live/latest?key=AIzaSyAfVT6NiDGeT3sgUhI1awaWvkGaelGBlyE";
const CYCLE_TOP_UTC = Date.UTC(2025, 9, 6);
const HISTORICAL_AVERAGE_BEAR_DAYS = 383;
const DAY_MS = 86_400_000;
const MAX_SNAPSHOT_AGE_MS = 36 * 60 * 60 * 1_000;
const PHASE_PRIORITY = ["mvrv", "nupl", "ahr999", "lthSupplyPct"];
const PHASE_THRESHOLDS = {
  mvrv: [[1, "accumulation"], [1.4, "bear"], [2.2, "early-bull"], [3.2, "late-bull"], [Infinity, "distribution"]],
  ahr999: [[0.45, "accumulation"], [1.2, "early-bull"], [4, "late-bull"], [Infinity, "distribution"]],
  nupl: [[0, "accumulation"], [0.25, "bear"], [0.5, "early-bull"], [0.75, "late-bull"], [Infinity, "distribution"]],
  lthSupplyPct: [[50, "distribution"], [65, "late-bull"], [75, "early-bull"], [85, "bear"], [Infinity, "accumulation"]],
};

export function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return undefined;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return Number(value.doubleValue);
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decodeFirestoreValue);
  if (value.mapValue) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, field]) => [key, decodeFirestoreValue(field)]),
    );
  }
  return undefined;
}

function decodeDocument(document) {
  if (!document?.fields) return document ?? {};
  return decodeFirestoreValue({ mapValue: { fields: document.fields } });
}

function classifyIndicator(name, value) {
  if (!Number.isFinite(value)) return null;
  for (const [upperBound, phase] of PHASE_THRESHOLDS[name]) {
    if (value < upperBound) return phase;
  }
  return null;
}

function derivePhase(snapshot) {
  const indicators = Array.isArray(snapshot.valuationIndicators) ? snapshot.valuationIndicators : [];
  const findIndicator = (pattern) => indicators.find((entry) => entry && pattern.test(entry.name ?? ""))?.value;
  const values = {
    mvrv: snapshot.mvrv?.value,
    nupl: findIndicator(/nupl|net\s*unrealized/i),
    ahr999: findIndicator(/ahr\s*999/i),
    lthSupplyPct: snapshot.lthSupply?.value,
  };
  const votes = Object.fromEntries(
    PHASE_PRIORITY
      .map((name) => [name, classifyIndicator(name, values[name])])
      .filter(([, phase]) => phase),
  );
  if (Object.keys(votes).length < 2) return "unknown";

  const counts = Object.values(votes).reduce((result, phase) => {
    result[phase] = (result[phase] ?? 0) + 1;
    return result;
  }, {});
  const highestCount = Math.max(...Object.values(counts));
  const leaders = Object.keys(counts).filter((phase) => counts[phase] === highestCount);
  if (leaders.length === 1) return leaders[0];
  return PHASE_PRIORITY.map((name) => votes[name]).find((phase) => leaders.includes(phase)) ?? "unknown";
}

export function deriveBitcoinReadout(document, now = new Date()) {
  const snapshot = decodeDocument(document);
  const updatedAt = validDate(snapshot.updatedAt, now);
  if (!updatedAt) throw new Error("Snapshot has no valid update timestamp");
  const price = observation(snapshot.price, now, (value) => value > 0);
  const drawdown = observation(snapshot.drawdownPct, now, (value) => value >= -100 && value <= 0);
  if (price.value === null && drawdown.value === null) throw new Error("Snapshot has no usable market observations");
  // Match the dashboard: nearest elapsed day, not completed UTC calendar days.
  const cycleDay = Math.max(0, Math.round((now.valueOf() - CYCLE_TOP_UTC) / DAY_MS));
  return {
    // Preserve the existing dashboard's indicator rules. Do not relabel this a current market phase.
    phase: derivePhase(snapshot),
    cycleDay,
    daysLeft: Math.max(0, HISTORICAL_AVERAGE_BEAR_DAYS - cycleDay),
    calendarDate: now.toISOString(),
    price: price.value,
    priceAsOf: price.asOf,
    priceRetained: price.retained,
    drawdownPct: drawdown.value,
    drawdownAsOf: drawdown.asOf,
    drawdownRetained: drawdown.retained,
    updatedAt,
  };
}

function validDate(value, now) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms <= now.valueOf() + 300_000 ? new Date(ms).toISOString() : null;
}

function observation(entry, now, inRange) {
  const asOf = validDate(entry?.asOf, now);
  const valid = asOf && Number.isFinite(entry?.value) && inRange(entry.value);
  return {
    value: valid ? entry.value : null,
    asOf: valid ? asOf : null,
    retained: entry?.stale !== false || !asOf || now.valueOf() - Date.parse(asOf) > MAX_SNAPSHOT_AGE_MS,
  };
}

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatBitcoinReadout(readout) {
  const formatDate = (value) => dateFormatter.format(new Date(value)).toUpperCase();
  const note = (asOf, retained) => asOf
    ? `As of ${formatDate(asOf)}${retained ? " · Retained observation" : ""}` : "Observation date unavailable";
  return {
    phase: readout.phase === "unknown" ? "Unavailable" : readout.phase.replaceAll("-", " ").toUpperCase(),
    cycleDay: integerFormatter.format(readout.cycleDay),
    daysLeft: `≈${integerFormatter.format(readout.daysLeft)}`,
    calendarDate: `Calendar as of ${formatDate(readout.calendarDate)} UTC`,
    price: Number.isFinite(readout.price) ? `$${integerFormatter.format(readout.price)}` : "Unavailable",
    drawdown: Number.isFinite(readout.drawdownPct) ? `${readout.drawdownPct.toFixed(1)}%` : "Unavailable",
    priceNote: note(readout.priceAsOf, readout.priceRetained),
    drawdownNote: note(readout.drawdownAsOf, readout.drawdownRetained),
    updatedDate: `Snapshot updated ${formatDate(readout.updatedAt)}`,
    status: "Snapshot data",
    sourceNote: "Checks the tracker source every five minutes while this page is visible. Market observations have their own dates; the snapshot update is not their observation time. The recorded phase uses the dashboard's indicator rules and may include older inputs.",
  };
}

function renderFields(values) {
  document.querySelectorAll("[data-btc-field]").forEach((element) => {
    const value = values[element.dataset.btcField];
    if (value === undefined) return;
    element.textContent = value;
    if (element instanceof HTMLTimeElement && values.updatedAt) element.dateTime = values.updatedAt;
  });
  document.documentElement.dataset.btcDataStatus = "snapshot";
}

export function createBitcoinUpdater({ fetchImpl = fetch, onUpdate, onError,
  now = () => new Date(), timers = window, isVisible = () => document.visibilityState === "visible" }) {
  let timer = null;
  let request = null;
  let generation = 0;

  function stop() {
    generation++;
    timers.clearTimeout(timer);
    timer = null;
    if (request) {
      timers.clearTimeout(request.timeout);
      request.controller.abort();
      request = null;
    }
  }

  async function refresh() {
    if (request || !isVisible()) return;
    timers.clearTimeout(timer);
    timer = null;
    const version = generation;
    const controller = new AbortController();
    const timeout = timers.setTimeout(() => controller.abort(), 10_000);
    request = { controller, timeout };
    try {
      const response = await fetchImpl(FIRESTORE_URL, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Bitcoin data request failed with HTTP ${response.status}`);
      const readout = deriveBitcoinReadout(await response.json(), now());
      if (version === generation && !controller.signal.aborted) onUpdate(readout);
    } catch (error) {
      if (version === generation) onError(error);
    } finally {
      timers.clearTimeout(timeout);
      if (version === generation) {
        request = null;
        if (isVisible()) timer = timers.setTimeout(refresh, POLL_INTERVAL_MS);
      }
    }
  }
  return { refresh, stop };
}

if (typeof window !== "undefined" && typeof document !== "undefined" && document.querySelector("[data-btc-field]")) {
  const updater = createBitcoinUpdater({
    onUpdate(readout) { renderFields({ ...formatBitcoinReadout(readout), updatedAt: readout.updatedAt }); },
    onError() {
      document.documentElement.dataset.btcDataStatus = "fallback";
      document.querySelectorAll('[data-btc-field="sourceNote"]').forEach((element) => {
        element.textContent = "Could not refresh the tracker source. The last displayed snapshot and observation dates are retained. Automatic checks resume while this page is visible; you can also open the dashboard below.";
      });
    },
  });
  updater.refresh();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updater.refresh();
    else updater.stop();
  });
  window.addEventListener("pagehide", updater.stop);
  window.addEventListener("pageshow", () => updater.refresh());
}
