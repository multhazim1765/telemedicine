import catalogJson from "./indiaMedicineCatalog.json";

export interface IndiaMedicineCatalogItem {
    id: string;
    medicineName: string;
    therapeuticClass: string;
    actionClass: string;
    manufacturer: string;
    packSize: string;
    priceINR: number | null;
    uses: string[];
    substitutes: string[];
    compositions: string[];
    sideEffects: string[];
}

type RawCatalogItem = Omit<IndiaMedicineCatalogItem, "uses" | "substitutes" | "compositions" | "sideEffects"> & {
    uses: unknown;
    substitutes: unknown;
    compositions: unknown;
    sideEffects: unknown;
};

const toSafeString = (value: unknown): string => {
    if (typeof value === "string") {
        return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value).trim();
    }
    return "";
};

const toArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return value.map((entry) => toSafeString(entry)).filter(Boolean);
    }
    if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>)
            .map((entry) => toSafeString(entry))
            .filter(Boolean);
    }
    const normalized = toSafeString(value);
    return normalized ? [normalized] : [];
};

const normalizeToken = (value: unknown): string => toSafeString(value).toLowerCase();

const normalizeCatalog = (items: RawCatalogItem[]): IndiaMedicineCatalogItem[] => {
    return items.map((item, index) => ({
        id: toSafeString(item.id) || `IND-${index + 1}`,
        medicineName: toSafeString(item.medicineName) || `Medicine ${index + 1}`,
        therapeuticClass: toSafeString(item.therapeuticClass) || "General",
        actionClass: toSafeString(item.actionClass),
        manufacturer: toSafeString(item.manufacturer),
        packSize: toSafeString(item.packSize),
        priceINR: typeof item.priceINR === "number" ? item.priceINR : null,
        uses: toArray(item.uses),
        substitutes: toArray(item.substitutes),
        compositions: toArray(item.compositions),
        sideEffects: toArray(item.sideEffects)
    }));
};

const FULL_CATALOG: IndiaMedicineCatalogItem[] = normalizeCatalog(catalogJson as RawCatalogItem[]);

interface RemoteChunkMeta {
    letter: string;
    file: string;
    count: number | null;
}

interface RemoteChunkIndex {
    total: number;
    chunks: RemoteChunkMeta[];
}

let remoteIndexCache: RemoteChunkIndex | null = null;
let remoteIndexPromise: Promise<RemoteChunkIndex | null> | null = null;
const remoteChunkCache = new Map<string, IndiaMedicineCatalogItem[]>();
const remoteChunkPromiseCache = new Map<string, Promise<IndiaMedicineCatalogItem[]>>();

type SearchRow = {
    entry: IndiaMedicineCatalogItem;
    name: string;
    therapeuticClass: string;
    usesText: string;
    substituteText: string;
    compositionText: string;
};

const SEARCH_ROWS: SearchRow[] = FULL_CATALOG.map((entry) => ({
    entry,
    name: normalizeToken(entry.medicineName),
    therapeuticClass: normalizeToken(entry.therapeuticClass),
    usesText: normalizeToken(entry.uses.join(" ")),
    substituteText: normalizeToken(entry.substitutes.join(" ")),
    compositionText: normalizeToken(entry.compositions.join(" "))
}));

const buildSearchRows = (catalog: IndiaMedicineCatalogItem[]): SearchRow[] =>
    catalog.map((entry) => ({
        entry,
        name: normalizeToken(entry.medicineName),
        therapeuticClass: normalizeToken(entry.therapeuticClass),
        usesText: normalizeToken(entry.uses.join(" ")),
        substituteText: normalizeToken(entry.substitutes.join(" ")),
        compositionText: normalizeToken(entry.compositions.join(" "))
    }));

let remoteSearchRowsCache: SearchRow[] | null = null;

const runSearch = (
    rows: SearchRow[],
    input: {
        query?: string;
        symptomHints?: string[];
        limit?: number;
    }
): IndiaMedicineCatalogItem[] => {
    const query = normalizeToken(input.query ?? "");
    const symptomHints = (input.symptomHints ?? []).map(normalizeToken).filter(Boolean);
    const limit = input.limit ?? 20;

    if (!query && symptomHints.length === 0) {
        return rows.slice(0, Math.max(1, limit)).map((row) => row.entry);
    }

    const scored: Array<{ entry: IndiaMedicineCatalogItem; score: number }> = [];

    for (const row of rows) {
        let score = 0;

        if (query) {
            const nameStartsWith = row.name.startsWith(query);
            const nameIncludes = row.name.includes(query);
            const substituteIncludes = row.substituteText.includes(query);
            const compositionIncludes = row.compositionText.includes(query);

            if (!nameIncludes && !substituteIncludes && !compositionIncludes) {
                continue;
            }

            if (nameStartsWith) {
                score += 140;
            } else if (nameIncludes) {
                score += 100;
            }
            if (substituteIncludes) {
                score += 45;
            }
            if (compositionIncludes) {
                score += 35;
            }
            if (row.usesText.includes(query)) {
                score += 8;
            }
            if (row.therapeuticClass.includes(query)) {
                score += 8;
            }
        }

        for (const hint of symptomHints) {
            if (row.usesText.includes(hint)) {
                score += 25;
            }
            if (row.therapeuticClass.includes(hint)) {
                score += 10;
            }
        }

        if (score > 0) {
            scored.push({ entry: row.entry, score });
        }
    }

    scored.sort((a, b) => b.score - a.score || a.entry.medicineName.localeCompare(b.entry.medicineName));

    return scored.slice(0, Math.max(1, limit)).map(({ entry }) => entry);
};

export const indiaMedicineCatalog: IndiaMedicineCatalogItem[] = FULL_CATALOG;

export const searchIndiaMedicines = (input: {
    query?: string;
    symptomHints?: string[];
    limit?: number;
}): IndiaMedicineCatalogItem[] => {
    return runSearch(SEARCH_ROWS, input);
};

const normalizeRemoteRow = (raw: unknown, index: number): IndiaMedicineCatalogItem => {
    const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return {
        id: toSafeString(record.id) || `IND-${index + 1}`,
        medicineName: toSafeString(record.medicineName) || `Medicine ${index + 1}`,
        therapeuticClass: toSafeString(record.therapeuticClass) || "General",
        actionClass: toSafeString(record.actionClass),
        manufacturer: toSafeString(record.manufacturer),
        packSize: toSafeString(record.packSize),
        priceINR: typeof record.priceINR === "number" ? record.priceINR : null,
        uses: toArray(record.uses),
        substitutes: toArray(record.substitutes),
        compositions: toArray(record.compositions),
        sideEffects: toArray(record.sideEffects)
    };
};

const normalizeChunkLetter = (value: string): string => {
    const token = value.trim().toUpperCase();
    return /^[A-Z]$/.test(token) ? token : "#";
};

const loadRemoteIndex = async (): Promise<RemoteChunkIndex | null> => {
    if (remoteIndexCache) {
        return remoteIndexCache;
    }

    if (!remoteIndexPromise) {
        remoteIndexPromise = fetch("/data/india-medicines/index.json")
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const payload = (await response.json()) as Record<string, unknown>;
                const total = typeof payload.total === "number" ? payload.total : 0;
                const rawChunks = Array.isArray(payload.chunks) ? payload.chunks : [];
                const chunks = rawChunks
                        .map((entry: unknown) => {
                            const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
                            const letter = normalizeChunkLetter(toSafeString(record.letter));
                            const file = toSafeString(record.file);
                            const count = typeof record.count === "number" ? record.count : null;
                            if (!file) {
                                return null;
                            }
                            return { letter, file, count } as RemoteChunkMeta;
                        })
                        .filter((entry: RemoteChunkMeta | null): entry is RemoteChunkMeta => Boolean(entry));

                const normalizedIndex: RemoteChunkIndex = {
                    total,
                    chunks
                };
                remoteIndexCache = normalizedIndex;
                return normalizedIndex;
            })
            .catch(() => {
                remoteIndexCache = null;
                return null;
            })
            .finally(() => {
                remoteIndexPromise = null;
            });
    }

    return remoteIndexPromise;
};

const getChunkByLetter = async (letter: string): Promise<IndiaMedicineCatalogItem[]> => {
    const normalizedLetter = normalizeChunkLetter(letter);
    const index = await loadRemoteIndex();
    const chunkMeta = index?.chunks.find((chunk) => chunk.letter === normalizedLetter);
    const file = chunkMeta?.file;

    if (!file) {
        return FULL_CATALOG;
    }

    const cached = remoteChunkCache.get(file);
    if (cached) {
        return cached;
    }

    const pending = remoteChunkPromiseCache.get(file);
    if (pending) {
        return pending;
    }

    const request = fetch(file)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const payload = await response.json();
            const rows = Array.isArray(payload) ? payload : [payload];
            const normalized = rows.map((row, rowIndex) => normalizeRemoteRow(row, rowIndex));
            remoteChunkCache.set(file, normalized);
            return normalized;
        })
        .catch(() => FULL_CATALOG)
        .finally(() => {
            remoteChunkPromiseCache.delete(file);
        });

    remoteChunkPromiseCache.set(file, request);
    return request;
};

export const searchIndiaMedicinesFull = async (input: {
    query?: string;
    symptomHints?: string[];
    limit?: number;
}): Promise<IndiaMedicineCatalogItem[]> => {
    const query = normalizeToken(input.query ?? "");
    const chunkLetter = query ? query.charAt(0) : "A";
    const chunkCatalog = await getChunkByLetter(chunkLetter);
    remoteSearchRowsCache = buildSearchRows(chunkCatalog);
    return runSearch(remoteSearchRowsCache, input);
};

export const getIndiaMedicinesFullCount = async (): Promise<number> => {
    const index = await loadRemoteIndex();
    if (index?.total) {
        return index.total;
    }
    return FULL_CATALOG.length;
};
