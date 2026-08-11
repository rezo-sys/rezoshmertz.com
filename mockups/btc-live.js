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
  const findIndicator = (pattern) => indicators.find(({ name = "" }) => pattern.test(name))?.value;
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

function utcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function deriveBitcoinReadout(document, now = new Date()) {
  const snapshot = decodeDocument(document);
  const cycleDay = Math.max(0, Math.floor((utcDay(now) - CYCLE_TOP_UTC) / DAY_MS));
  const updatedAtMs = Date.parse(snapshot.updatedAt);
  const requiredDataIsStale = [snapshot.price, snapshot.drawdownPct].some((entry) => !entry || entry.stale === true);
  const indicatorIsStale = [snapshot.mvrv, snapshot.lthSupply].some((entry) => entry?.stale === true);
  const snapshotIsOld = !Number.isFinite(updatedAtMs) || now.valueOf() - updatedAtMs > MAX_SNAPSHOT_AGE_MS;
  return {
    phase: derivePhase(snapshot),
    cycleDay,
    daysLeft: Math.max(0, HISTORICAL_AVERAGE_BEAR_DAYS - cycleDay),
    price: snapshot.price?.value ?? null,
    drawdownPct: snapshot.drawdownPct?.value ?? null,
    updatedAt: snapshot.updatedAt ?? null,
    isDelayed: requiredDataIsStale || indicatorIsStale || snapshotIsOld,
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
  const updated = readout.updatedAt ? new Date(readout.updatedAt) : null;
  return {
    phase: readout.phase === "unknown" ? "—" : readout.phase.replaceAll("-", " ").toUpperCase(),
    cycleDay: integerFormatter.format(readout.cycleDay),
    daysLeft: `≈${integerFormatter.format(readout.daysLeft)}`,
    price: Number.isFinite(readout.price) ? `$${integerFormatter.format(readout.price)}` : "—",
    drawdown: Number.isFinite(readout.drawdownPct) ? `${readout.drawdownPct.toFixed(1)}%` : "—",
    updatedDate: updated && !Number.isNaN(updated.valueOf())
      ? `${readout.isDelayed ? "UPDATED" : "LIVE"} ${dateFormatter.format(updated).toUpperCase()}`
      : "DATA STATUS UNKNOWN",
    status: readout.isDelayed ? "DELAYED DATA" : "LIVE DATA",
  };
}

function renderFields(values) {
  document.querySelectorAll("[data-btc-field]").forEach((element) => {
    const value = values[element.dataset.btcField];
    if (value === undefined) return;
    element.textContent = value;
    if (element instanceof HTMLTimeElement && values.updatedAt) element.dateTime = values.updatedAt;
  });
  document.documentElement.dataset.btcDataStatus = "live";
}

async function refreshBitcoinReadout() {
  try {
    const response = await fetch(FIRESTORE_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Bitcoin data request failed with HTTP ${response.status}`);
    const readout = deriveBitcoinReadout(await response.json(), new Date());
    const formatted = formatBitcoinReadout(readout);
    renderFields({ ...formatted, updatedAt: readout.updatedAt });
  } catch {
    document.documentElement.dataset.btcDataStatus = "fallback";
    document.querySelectorAll('[data-btc-field="status"]').forEach((element) => {
      element.textContent = "CACHED SCENARIO";
    });
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  refreshBitcoinReadout();
  window.setInterval(refreshBitcoinReadout, POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshBitcoinReadout();
  });
}
