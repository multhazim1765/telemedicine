import catalogJson from "./indiaMedicineCatalogSeed.json";

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

const RUNTIME_MEDICINE_LIMIT = 220;

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
        return value
            .map((entry) => toSafeString(entry))
            .filter(Boolean);
    }
    const normalized = toSafeString(value);
    return normalized ? [normalized] : [];
};

const normalizeToken = (value: unknown): string => toSafeString(value).toLowerCase();

const normalizeCatalog = (items: RawCatalogItem[], limit?: number): IndiaMedicineCatalogItem[] => {
    const source = typeof limit === "number" ? items.slice(0, limit) : items;
    return source.map((item) => ({
        id: toSafeString(item.id),
        medicineName: toSafeString(item.medicineName),
        therapeuticClass: toSafeString(item.therapeuticClass),
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

const runSearch = (
    catalog: IndiaMedicineCatalogItem[],
    input: {
        query?: string;
        symptomHints?: string[];
        limit?: number;
    }
): IndiaMedicineCatalogItem[] => {
    const query = normalizeToken(input.query ?? "");
    const symptomHints = (input.symptomHints ?? []).map(normalizeToken).filter(Boolean);
    const limit = input.limit ?? 20;

    const scored = catalog
        .map((entry) => {
            const name = normalizeToken(entry.medicineName);
            const therapeuticClass = normalizeToken(entry.therapeuticClass);
            const usesText = normalizeToken(entry.uses.join(" "));
            const substituteText = normalizeToken(entry.substitutes.join(" "));
            const compositionText = normalizeToken(entry.compositions.join(" "));

            let score = 0;
            if (query) {
                const nameStartsWith = name.startsWith(query);
                const nameIncludes = name.includes(query);
                const substituteIncludes = substituteText.includes(query);
                const compositionIncludes = compositionText.includes(query);

                // For typed medicine search, require match in name/substitute/composition.
                if (!nameIncludes && !substituteIncludes && !compositionIncludes) {
                    return { entry, score: 0 };
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

                // Uses/class are secondary relevance signals only.
                if (name.includes(query)) {
                    score += 20;
                }
                if (usesText.includes(query)) {
                    score += 8;
                }
                if (therapeuticClass.includes(query)) {
                    score += 8;
                }
                if (substituteText.includes(query)) {
                    score += 10;
                }
            }

            for (const hint of symptomHints) {
                if (usesText.includes(hint)) {
                    score += 25;
                }
                if (therapeuticClass.includes(hint)) {
                    score += 10;
                }
            }

            return { entry, score };
        })
        .filter(({ score }) => (query || symptomHints.length > 0 ? score > 0 : true))
        .sort((a, b) => b.score - a.score || a.entry.medicineName.localeCompare(b.entry.medicineName));

    return scored.slice(0, limit).map(({ entry }) => entry);
};

export const indiaMedicineCatalog: IndiaMedicineCatalogItem[] = normalizeCatalog(
    catalogJson as RawCatalogItem[],
    RUNTIME_MEDICINE_LIMIT
);

let fullCatalogCache: IndiaMedicineCatalogItem[] | null = null;
let fullCatalogPromise: Promise<IndiaMedicineCatalogItem[]> | null = null;

const loadFullCatalog = async (): Promise<IndiaMedicineCatalogItem[]> => {
    if (fullCatalogCache) {
        return fullCatalogCache;
    }

    if (!fullCatalogPromise) {
        fullCatalogPromise = fetch("/data/india-tablets.min.json")
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load full tablet catalog: HTTP ${response.status}`);
                }
                return response.json() as Promise<RawCatalogItem[]>;
            })
            .then((rows) => normalizeCatalog(rows))
            .then((catalog) => {
                fullCatalogCache = catalog;
                return catalog;
            })
            .catch(() => indiaMedicineCatalog);
    }

    return fullCatalogPromise;
};

export const searchIndiaMedicines = (input: {
    query?: string;
    symptomHints?: string[];
    limit?: number;
}): IndiaMedicineCatalogItem[] => runSearch(indiaMedicineCatalog, input);

export const searchIndiaMedicinesFull = async (input: {
    query?: string;
    symptomHints?: string[];
    limit?: number;
}): Promise<IndiaMedicineCatalogItem[]> => {
    const fullCatalog = await loadFullCatalog();
    return runSearch(fullCatalog, input);
};
