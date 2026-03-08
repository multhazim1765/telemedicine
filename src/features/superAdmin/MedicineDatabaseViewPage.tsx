import { useEffect, useMemo, useState } from "react";

interface MedicineDatabaseRow {
  id: string;
  medicineName: string;
  therapeuticClass: string;
  isDiscontinued: string;
  manufacturer: string;
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

  return {
    id,
    medicineName,
    therapeuticClass,
    manufacturer,
    isDiscontinued
  };
};

export const MedicineDatabaseViewPage = () => {
  const [rows, setRows] = useState<MedicineDatabaseRow[]>([]);
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    void fetch("/data/india-all-medicines.min.json")
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
        const normalized = Array.isArray(data) ? data.map((row, index) => normalizeRow(row, index)) : [];
        setRows(normalized);
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

  const filteredView = useMemo(() => {
    const token = searchText.trim().toLowerCase();
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    if (!token) {
      return {
        totalMatches: rows.length,
        pageRows: rows.slice(start, end)
      };
    }

    let totalMatches = 0;
    const pageRows: MedicineDatabaseRow[] = [];

    for (const row of rows) {
      const matches =
        row.id.toLowerCase().includes(token) ||
        row.medicineName.toLowerCase().includes(token) ||
        row.therapeuticClass.toLowerCase().includes(token) ||
        row.manufacturer.toLowerCase().includes(token);

      if (!matches) {
        continue;
      }

      if (totalMatches >= start && totalMatches < end) {
        pageRows.push(row);
      }
      totalMatches += 1;
    }

    return {
      totalMatches,
      pageRows
    };
  }, [rows, searchText, page]);

  const totalPages = Math.max(1, Math.ceil(filteredView.totalMatches / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchText]);

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
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Total rows: <span className="font-semibold">{rows.length.toLocaleString()}</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Match rows: <span className="font-semibold">{filteredView.totalMatches.toLocaleString()}</span>
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
            {filteredView.pageRows.map((medicine, index) => (
              <tr key={`${medicine.id}-${medicine.medicineName}-${index}`} className="border-t border-slate-100">
                <td className="px-2 py-2">{medicine.id}</td>
                <td className="px-2 py-2">{medicine.medicineName}</td>
                <td className="px-2 py-2">{medicine.therapeuticClass}</td>
                <td className="px-2 py-2">{medicine.manufacturer}</td>
                <td className="px-2 py-2">{medicine.isDiscontinued}</td>
              </tr>
            ))}
            {!loading && filteredView.pageRows.length === 0 && (
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
