import { useEffect, useMemo, useRef, useState } from "react";

interface MedicineDatabaseRow {
  id: string;
  medicineName: string;
  therapeuticClass: string;
  isDiscontinued: string;
  manufacturer: string;
  uses: string[];
  substitutes: string[];
}

interface MedicineChunkMeta {
  letter: string;
  file: string;
  count: number | null;
}

interface MedicineChunkIndex {
  total: number;
  chunks: MedicineChunkMeta[];
}

const PAGE_SIZE = 100;

const toSafeString = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
};

const normalizeRow = (raw: unknown, index: number): MedicineDatabaseRow => {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const id = toSafeString(record.id, `IND-${index + 1}`);
  const medicineName = toSafeString(record.medicineName, `Unnamed medicine ${index + 1}`);
  const therapeuticClass = toSafeString(record.therapeuticClass, "General");
  const manufacturer = toSafeString(record.manufacturer, "N/A");
  const isDiscontinued = toSafeString(record.isDiscontinued, "False");
  const uses = Array.isArray(record.uses)
    ? record.uses.map((entry) => toSafeString(entry)).filter(Boolean)
    : [];
  const substitutes = Array.isArray(record.substitutes)
    ? record.substitutes.map((entry) => toSafeString(entry)).filter(Boolean)
    : [];

  return {
    id,
    medicineName,
    therapeuticClass,
    manufacturer,
    isDiscontinued,
    uses,
    substitutes
  };
};

const normalizeLetter = (value: string): string => {
  const letter = value.trim().toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "#";
};

const firstCharLetter = (value: string): string => {
  if (!value) {
    return "#";
  }
  return normalizeLetter(value[0]);
};

export const MedicineDatabaseViewPage = () => {
  const [rows, setRows] = useState<MedicineDatabaseRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalMatches, setTotalMatches] = useState(0);
  const [indexData, setIndexData] = useState<MedicineChunkIndex | null>(null);
  const chunkCacheRef = useRef<Record<string, MedicineDatabaseRow[]>>({});

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void fetch("/data/india-medicines/index.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Unable to load medicine database (HTTP ${response.status})`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((data) => {
        if (!active) {
          return;
        }
        const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
        const chunks = Array.isArray(payload.chunks)
          ? payload.chunks
            .map((entry) => {
              const chunk = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
              const letter = normalizeLetter(toSafeString(chunk.letter));
              const file = toSafeString(chunk.file);
              const count = typeof chunk.count === "number" ? chunk.count : null;
              if (!file) {
                return null;
              }
              return { letter, file, count } as MedicineChunkMeta;
            })
            .filter((entry): entry is MedicineChunkMeta => Boolean(entry))
          : [];

        setIndexData({
          total: typeof payload.total === "number" ? payload.total : 0,
          chunks
        });
      })
      .catch((fetchError: unknown) => {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load medicine database");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const getChunkRows = async (chunk: MedicineChunkMeta): Promise<MedicineDatabaseRow[]> => {
    const cached = chunkCacheRef.current[chunk.file];
    if (cached) {
      return cached;
    }

    const response = await fetch(chunk.file);
    if (!response.ok) {
      throw new Error(`Unable to load chunk ${chunk.letter} (HTTP ${response.status})`);
    }

    const data = (await response.json()) as unknown;
    const rawRows = Array.isArray(data) ? data : [data];
    const normalized = rawRows.map((row, index) => normalizeRow(row, index));
    chunkCacheRef.current[chunk.file] = normalized;
    return normalized;
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!indexData) {
        return;
      }

      setLoading(true);
      setError("");

      const token = searchText.trim().toLowerCase();

      try {
        const allChunks = indexData.chunks;
        const scopedChunks = selectedLetter === "ALL"
          ? allChunks
          : allChunks.filter((chunk) => chunk.letter === selectedLetter);

        if (token) {
          const effectiveChunks = selectedLetter === "ALL"
            ? allChunks.filter((chunk) => chunk.letter === firstCharLetter(token))
            : scopedChunks;

          const chunkRows = (await Promise.all(effectiveChunks.map((chunk) => getChunkRows(chunk)))).flat();
          const matchingRows = chunkRows.filter((row) => (
            row.id.toLowerCase().includes(token) ||
            row.medicineName.toLowerCase().includes(token) ||
            row.therapeuticClass.toLowerCase().includes(token) ||
            row.manufacturer.toLowerCase().includes(token) ||
            row.uses.join(" ").toLowerCase().includes(token) ||
            row.substitutes.join(" ").toLowerCase().includes(token)
          ));

          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;

          if (active) {
            setRows(matchingRows.slice(start, end));
            setTotalMatches(matchingRows.length);
          }
          return;
        }

        if (selectedLetter !== "ALL") {
          const onlyChunk = scopedChunks[0];
          if (!onlyChunk) {
            if (active) {
              setRows([]);
              setTotalMatches(0);
            }
            return;
          }

          const chunkRows = await getChunkRows(onlyChunk);
          const start = (page - 1) * PAGE_SIZE;
          const end = start + PAGE_SIZE;
          if (active) {
            setRows(chunkRows.slice(start, end));
            setTotalMatches(chunkRows.length);
          }
          return;
        }

        const start = (page - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageRows: MedicineDatabaseRow[] = [];
        let seen = 0;

        for (const chunk of allChunks) {
          const chunkRows = await getChunkRows(chunk);
          const chunkLength = chunkRows.length;
          const chunkStart = seen;
          const chunkEnd = seen + chunkLength;

          if (chunkEnd <= start) {
            seen = chunkEnd;
            continue;
          }

          if (chunkStart >= end) {
            break;
          }

          const localStart = Math.max(0, start - chunkStart);
          const localEnd = Math.min(chunkLength, end - chunkStart);
          pageRows.push(...chunkRows.slice(localStart, localEnd));
          seen = chunkEnd;

          if (pageRows.length >= PAGE_SIZE) {
            break;
          }
        }

        if (active) {
          setRows(pageRows);
          setTotalMatches(indexData.total || allChunks.reduce((sum, chunk) => sum + (chunk.count ?? 0), 0));
        }
      } catch (fetchError: unknown) {
        if (!active) {
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load medicine database");
        setRows([]);
        setTotalMatches(0);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [indexData, page, searchText, selectedLetter]);

  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const letterOptions = useMemo(() => ["ALL", "#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")], []);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchText, selectedLetter]);

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-base font-semibold text-slate-800">Medicine Database View (Read Only)</h2>
      <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
        <input
          className="input"
          placeholder="Search by name, ID, class, use, substitute"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <select
          className="input"
          value={selectedLetter}
          onChange={(event) => setSelectedLetter(event.target.value)}
          aria-label="Filter by starting letter"
        >
          {letterOptions.map((letter) => (
            <option key={letter} value={letter}>
              {letter === "ALL" ? "All letters" : `Starts with ${letter}`}
            </option>
          ))}
        </select>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Total rows: <span className="font-semibold">{(indexData?.total ?? 0).toLocaleString()}</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Match rows: <span className="font-semibold">{totalMatches.toLocaleString()}</span>
        </div>
      </div>

      {loading && <p className="mb-2 text-sm text-slate-600">Loading full medicine database...</p>}
      {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">ID</th>
              <th className="px-2 py-2">Medicine</th>
              <th className="px-2 py-2">Therapeutic Class</th>
              <th className="px-2 py-2">Manufacturer</th>
              <th className="px-2 py-2">Discontinued</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((medicine, index) => (
              <tr key={`${medicine.id}-${medicine.medicineName}-${index}`} className="border-t border-slate-100">
                <td className="px-2 py-2">{medicine.id}</td>
                <td className="px-2 py-2">{medicine.medicineName}</td>
                <td className="px-2 py-2">{medicine.therapeuticClass}</td>
                <td className="px-2 py-2">{medicine.manufacturer}</td>
                <td className="px-2 py-2">{medicine.isDiscontinued}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr className="border-t border-slate-100">
                <td className="px-2 py-3 text-slate-500" colSpan={5}>No medicines found for this search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          className="btn-muted"
          disabled={currentPage <= 1}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Previous
        </button>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
          Page {currentPage} / {totalPages}
        </span>
        <button
          className="btn-muted"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
        >
          Next
        </button>
      </div>
    </section>
  );
};
