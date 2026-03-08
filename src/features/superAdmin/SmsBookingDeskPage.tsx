import { useEffect, useMemo, useState } from "react";
import { setDocumentById, subscribeCollection } from "../../services/firestoreService";
import { Doctor, HospitalCatalog, IvrMenuConfig, IvrMenuMapping, SmsBooking } from "../../types/models";
import { nowIso } from "../../utils/date";
import { districts } from "../../constants/districts";

const sanitizeIvrNumber = (value: string): string => value.replace(/\D/g, "").slice(0, 6);

const normalizeDistrict = (value: string | undefined): string => (value ?? "Unknown District").trim() || "Unknown District";

export const SmsBookingDeskPage = () => {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [hospitals, setHospitals] = useState<HospitalCatalog[]>([]);
    const [smsBookings, setSmsBookings] = useState<SmsBooking[]>([]);
    const [ivrConfigs, setIvrConfigs] = useState<IvrMenuConfig[]>([]);
    const [menuVersion, setMenuVersion] = useState(1);
    const [defaultHospitalName, setDefaultHospitalName] = useState("");
    const [menuRows, setMenuRows] = useState<IvrMenuMapping[]>([]);
    const [searchText, setSearchText] = useState("");
    const [isSavingMenu, setIsSavingMenu] = useState(false);
    const [ivrStatusText, setIvrStatusText] = useState("");

    const searchToken = searchText.trim().toLowerCase();

    const districtOrderMap = useMemo(
        () => {
            const map = new Map<string, number>();
            districts.forEach((district, index) => {
                map.set(district.toLowerCase(), index + 1);
            });
            return map;
        },
        []
    );

    const doctorRoutes = useMemo(
        () =>
            doctors
                .filter((doctor) => Boolean(doctor.id) && Boolean(doctor.hospitalName))
                .sort((a, b) => {
                    const districtA = normalizeDistrict(a.district);
                    const districtB = normalizeDistrict(b.district);
                    const districtOrder = districtA.localeCompare(districtB);
                    if (districtOrder !== 0) {
                        return districtOrder;
                    }
                    const hospitalOrder = a.hospitalName.localeCompare(b.hospitalName);
                    if (hospitalOrder !== 0) {
                        return hospitalOrder;
                    }
                    return a.name.localeCompare(b.name);
                }),
        [doctors]
    );

    const arrangedDoctorRoutes = useMemo(() => {
        const byDistrict = new Map<string, Doctor[]>();
        for (const doctor of doctorRoutes) {
            const district = normalizeDistrict(doctor.district);
            const list = byDistrict.get(district) ?? [];
            list.push(doctor);
            byDistrict.set(district, list);
        }

        const districtNames = Array.from(byDistrict.keys()).sort((a, b) => {
            const aOrder = districtOrderMap.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
            const bOrder = districtOrderMap.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            return a.localeCompare(b);
        });

        const arranged: Array<{ doctor: Doctor; districtName: string; districtOrder: number; hospitalOrder: number; doctorOrder: number; ivrCode: string }> = [];
        let unknownDistrictOffset = 0;

        for (const districtName of districtNames) {
            const districtDoctors = byDistrict.get(districtName) ?? [];
            const knownDistrictOrder = districtOrderMap.get(districtName.toLowerCase());
            const districtOrdinal = knownDistrictOrder ?? (districts.length + (++unknownDistrictOffset));

            const hospitals = Array.from(new Set(districtDoctors.map((doctor) => doctor.hospitalName))).sort((a, b) => a.localeCompare(b));

            hospitals.forEach((hospitalName, hospitalIndex) => {
                const doctorsInHospital = districtDoctors
                    .filter((doctor) => doctor.hospitalName === hospitalName)
                    .sort((a, b) => a.name.localeCompare(b.name));

                doctorsInHospital.forEach((doctor, doctorIndex) => {
                    const hospitalOrder = hospitalIndex + 1;
                    const doctorOrder = doctorIndex + 1;
                    const ivrCode = `${districtOrdinal}${hospitalOrder}${doctorOrder}`;
                    arranged.push({
                        doctor,
                        districtName,
                        districtOrder: districtOrdinal,
                        hospitalOrder,
                        doctorOrder,
                        ivrCode
                    });
                });
            });
        }

        return arranged;
    }, [districtOrderMap, doctorRoutes]);

    const doctorById = useMemo(
        () => new Map(arrangedDoctorRoutes.map((entry) => [entry.doctor.id, entry.doctor])),
        [arrangedDoctorRoutes]
    );

    const districtGroups = useMemo(() => {
        const grouped = new Map<string, Map<string, Array<{ row: IvrMenuMapping; index: number }>>>();

        menuRows.forEach((row, index) => {
            const doctor = row.doctorId ? doctorById.get(row.doctorId) : undefined;
            const district = (doctor?.district ?? "Unknown District").trim() || "Unknown District";
            const hospital = (row.hospitalName ?? "Unknown Hospital").trim() || "Unknown Hospital";

            const hospitalsForDistrict = grouped.get(district) ?? new Map<string, Array<{ row: IvrMenuMapping; index: number }>>();
            const rowsForHospital = hospitalsForDistrict.get(hospital) ?? [];
            rowsForHospital.push({ row, index });
            hospitalsForDistrict.set(hospital, rowsForHospital);
            grouped.set(district, hospitalsForDistrict);
        });

        return Array.from(grouped.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([district, hospitals]) => ({
                district,
                hospitals: Array.from(hospitals.entries())
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([hospital, rows]) => ({
                        hospital,
                        rows: rows.sort((a, b) => (a.row.doctorName ?? "").localeCompare(b.row.doctorName ?? ""))
                    }))
            }));
    }, [doctorById, menuRows]);

    useEffect(() => {
        const unsubDoctors = subscribeCollection("doctors", setDoctors);
        const unsubHospitals = subscribeCollection("hospital_catalog", setHospitals);
        const unsubSmsBookings = subscribeCollection("sms_bookings", setSmsBookings);
        const unsubIvrMenu = subscribeCollection("ivr_menu_config", setIvrConfigs);

        return () => {
            unsubDoctors();
            unsubHospitals();
            unsubSmsBookings();
            unsubIvrMenu();
        };
    }, []);

    useEffect(() => {
        const active = ivrConfigs.find((config) => config.id === "active") ?? ivrConfigs[0];
        const allHospitals = Array.from(new Set(arrangedDoctorRoutes.map((entry) => entry.doctor.hospitalName))).sort((a, b) => a.localeCompare(b));
        if (arrangedDoctorRoutes.length === 0 || allHospitals.length === 0) {
            setMenuRows([]);
            return;
        }

        const mappingByDoctor = new Map<string, IvrMenuMapping>();
        for (const entry of active?.mappings ?? []) {
            const hospitalName = entry.hospitalName?.trim();
            if (!hospitalName) {
                continue;
            }

            if (entry.doctorId?.trim()) {
                const doctorId = entry.doctorId.trim();
                if (!mappingByDoctor.has(doctorId)) {
                    mappingByDoctor.set(doctorId, {
                        digit: sanitizeIvrNumber(entry.digit ?? ""),
                        hospitalName,
                        doctorId,
                        doctorName: entry.doctorName,
                        priority: entry.priority,
                        active: entry.active !== false
                    });
                }
            }
        }

        setMenuVersion(active?.menuVersion || 1);
        setDefaultHospitalName(active?.defaultHospitalName ?? allHospitals[0] ?? "");

        const rebuiltRows = arrangedDoctorRoutes.map((entry, index) => {
            return {
                digit: entry.ivrCode,
                hospitalName: entry.doctor.hospitalName,
                doctorId: entry.doctor.id,
                doctorName: entry.doctor.name,
                // Keep priority deterministic and contiguous after doctor additions.
                priority: index + 1,
                active: mappingByDoctor.get(entry.doctor.id)?.active ?? true
            };
        });

        const activeDoctorIds = new Set(arrangedDoctorRoutes.map((entry) => entry.doctor.id));
        const preservedRows = (active?.mappings ?? [])
            .filter((entry) => {
                const doctorId = entry.doctorId?.trim();
                if (!doctorId) {
                    return false;
                }
                return !activeDoctorIds.has(doctorId);
            })
            .map((entry, index) => ({
                digit: sanitizeIvrNumber(entry.digit ?? ""),
                hospitalName: entry.hospitalName?.trim() || "Unknown Hospital",
                doctorId: entry.doctorId?.trim() || "",
                doctorName: entry.doctorName?.trim() || "",
                priority: entry.priority || rebuiltRows.length + index + 1,
                active: entry.active !== false
            }))
            .sort((a, b) => a.priority - b.priority);

        const resequencedRows = [...rebuiltRows, ...preservedRows].map((row, index) => ({
            ...row,
            priority: index + 1
        }));

        setMenuRows(resequencedRows);
    }, [arrangedDoctorRoutes, ivrConfigs]);

    const hospitalNames = useMemo(() => {
        const fromCatalog = hospitals
            .map((hospital) => hospital.hospitalName)
            .filter(Boolean);
        const fallbackFromDoctors = doctors.map((doctor) => doctor.hospitalName).filter(Boolean);
        return Array.from(new Set((fromCatalog.length > 0 ? fromCatalog : fallbackFromDoctors))).sort((a, b) => a.localeCompare(b));
    }, [doctors, hospitals]);

    const recentSmsBookings = useMemo(() => {
        const sorted = [...smsBookings].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
        if (!searchToken) {
            return sorted.slice(0, 20);
        }

        return sorted
            .filter((entry) => {
                const searchable = [
                    entry.smsMessageId,
                    entry.normalizedSenderPhone,
                    entry.senderPhone,
                    entry.parsedCommand,
                    entry.smsText,
                    entry.selectedHospitalName,
                    entry.doctorName,
                    entry.doctorId,
                    entry.smsStatus,
                    entry.status
                ]
                    .map((value) => String(value ?? "").toLowerCase())
                    .join(" ");
                return searchable.includes(searchToken);
            })
            .slice(0, 50);
    }, [smsBookings, searchToken]);

    const filteredDistrictGroups = useMemo(() => {
        if (!searchToken) {
            return districtGroups;
        }

        return districtGroups
            .map((districtGroup) => {
                const districtMatch = districtGroup.district.toLowerCase().includes(searchToken);
                const hospitals = districtGroup.hospitals
                    .map((hospitalGroup) => {
                        const hospitalMatch = hospitalGroup.hospital.toLowerCase().includes(searchToken);
                        const rows = hospitalGroup.rows.filter(({ row }) => {
                            const rowSearchable = [
                                row.digit,
                                row.hospitalName,
                                row.doctorName,
                                row.doctorId,
                                row.priority,
                                row.active ? "active" : "inactive"
                            ]
                                .map((value) => String(value ?? "").toLowerCase())
                                .join(" ");
                            return rowSearchable.includes(searchToken) || districtMatch || hospitalMatch;
                        });

                        if (!districtMatch && !hospitalMatch && rows.length === 0) {
                            return null;
                        }

                        return {
                            ...hospitalGroup,
                            rows: districtMatch || hospitalMatch ? hospitalGroup.rows : rows
                        };
                    })
                    .filter((hospital): hospital is NonNullable<typeof hospital> => Boolean(hospital));

                if (districtMatch || hospitals.length > 0) {
                    return {
                        ...districtGroup,
                        hospitals: districtMatch ? districtGroup.hospitals : hospitals
                    };
                }

                return null;
            })
            .filter((group): group is NonNullable<typeof group> => Boolean(group));
    }, [districtGroups, searchToken]);

    const onUpdateMenuRow = (index: number, patch: Partial<IvrMenuMapping>) => {
        setMenuRows((current) => current.map((entry, idx) => (idx === index ? { ...entry, ...patch } : entry)));
    };

    useEffect(() => {
        const active = ivrConfigs.find((config) => config.id === "active") ?? ivrConfigs[0];
        if (arrangedDoctorRoutes.length === 0) {
            return;
        }

        const existingByDoctor = new Map<string, IvrMenuMapping>();
        for (const entry of active?.mappings ?? []) {
            const doctorId = entry.doctorId?.trim();
            if (!doctorId || existingByDoctor.has(doctorId)) {
                continue;
            }
            existingByDoctor.set(doctorId, entry);
        }

        const expectedMappings = arrangedDoctorRoutes.map((entry, index) => {
            return {
                digit: entry.ivrCode,
                hospitalName: entry.doctor.hospitalName,
                doctorId: entry.doctor.id,
                doctorName: entry.doctor.name,
                // Auto-order priorities by district/hospital/doctor arrangement.
                priority: index + 1,
                active: existingByDoctor.get(entry.doctor.id)?.active ?? true
            };
        });

        const activeDoctorIds = new Set(arrangedDoctorRoutes.map((entry) => entry.doctor.id));
        const preservedMappings = (active?.mappings ?? [])
            .filter((entry) => {
                const doctorId = entry.doctorId?.trim();
                if (!doctorId) {
                    return false;
                }
                return !activeDoctorIds.has(doctorId);
            })
            .map((entry, index) => ({
                digit: sanitizeIvrNumber(entry.digit ?? ""),
                hospitalName: entry.hospitalName?.trim() || "Unknown Hospital",
                doctorId: entry.doctorId?.trim() || "",
                doctorName: entry.doctorName?.trim() || "",
                priority: entry.priority || expectedMappings.length + index + 1,
                active: entry.active !== false
            }))
            .sort((a, b) => a.priority - b.priority);

        const mergedExpectedMappings = [...expectedMappings, ...preservedMappings].map((entry, index) => ({
            ...entry,
            priority: index + 1
        }));

        const normalizeSignature = (mappings: IvrMenuMapping[]): string =>
            [...mappings]
                .map((mapping) => ({
                    digit: String(mapping.digit ?? ""),
                    hospitalName: String(mapping.hospitalName ?? ""),
                    doctorId: String(mapping.doctorId ?? ""),
                    doctorName: String(mapping.doctorName ?? ""),
                    priority: Number(mapping.priority ?? 0),
                    active: mapping.active !== false
                }))
                .sort((a, b) => a.doctorId.localeCompare(b.doctorId))
                .map((entry) => `${entry.doctorId}|${entry.digit}|${entry.hospitalName}|${entry.doctorName}|${entry.priority}|${entry.active ? "1" : "0"}`)
                .join(";");

        const currentSignature = normalizeSignature(active?.mappings ?? []);
        const expectedSignature = normalizeSignature(mergedExpectedMappings);
        const expectedDefaultHospital = active?.defaultHospitalName ?? hospitalNames[0] ?? "";
        const currentDefaultHospital = active?.defaultHospitalName ?? "";

        if (currentSignature === expectedSignature && currentDefaultHospital === expectedDefaultHospital) {
            return;
        }

        void setDocumentById("ivr_menu_config", "active", {
            id: "active",
            active: true,
            menuVersion: active?.menuVersion || 1,
            defaultHospitalName: expectedDefaultHospital,
            mappings: mergedExpectedMappings,
            updatedBy: "system_auto_sync",
            updatedAt: nowIso(),
            createdAt: active?.createdAt ?? nowIso()
        }).then(() => {
            setIvrStatusText("IVR auto-synced with latest doctor/hospital changes.");
        }).catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Unknown auto-sync error";
            setIvrStatusText(`Failed to auto-sync IVR: ${message}`);
        });
    }, [arrangedDoctorRoutes, hospitalNames, ivrConfigs]);

    const onSaveIvrMenu = async () => {
        if (isSavingMenu) {
            return;
        }

        const normalizedRows = menuRows
            .map((row, index) => ({
                digit: sanitizeIvrNumber(row.digit),
                hospitalName: row.hospitalName.trim(),
                doctorId: row.doctorId?.trim() || "",
                doctorName: row.doctorName?.trim() || "",
                priority: row.priority || index + 1,
                active: row.active
            }))
            .filter((row) => row.digit && row.hospitalName && row.doctorId);

        if (normalizedRows.some((row) => row.digit.length < 3)) {
            setIvrStatusText("Each IVR number must be at least 3 digits.");
            return;
        }

        const uniqueDigits = new Set(normalizedRows.map((row) => row.digit));
        if (uniqueDigits.size !== normalizedRows.length) {
            setIvrStatusText("IVR numbers must be unique in IVR menu.");
            return;
        }

        const activeDoctorIds = new Set(doctorRoutes.map((doctor) => doctor.id));
        const coveredActiveDoctors = new Set(
            normalizedRows
                .map((row) => row.doctorId)
                .filter((doctorId) => activeDoctorIds.has(doctorId))
        );
        if (coveredActiveDoctors.size !== activeDoctorIds.size) {
            setIvrStatusText("Every doctor must have exactly one IVR number.");
            return;
        }

        const resolvedDefaultHospital = defaultHospitalName || hospitalNames[0] || "";
        if (!resolvedDefaultHospital) {
            setIvrStatusText("No default hospital route available.");
            return;
        }

        setIsSavingMenu(true);
        setIvrStatusText("Saving IVR menu configuration...");
        try {
            await setDocumentById("ivr_menu_config", "active", {
                id: "active",
                active: true,
                menuVersion: menuVersion > 0 ? menuVersion : 1,
                defaultHospitalName: resolvedDefaultHospital,
                mappings: normalizedRows,
                updatedBy: "super_admin",
                updatedAt: nowIso(),
                createdAt: nowIso()
            });
            setIvrStatusText("IVR menu saved. SMS booking webhook will use this mapping.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown save error";
            setIvrStatusText(`Failed to save IVR menu: ${message}`);
        } finally {
            setIsSavingMenu(false);
        }
    };

    return (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-base font-semibold text-slate-800">SMS Booking Desk</h2>
            <p className="mb-3 text-xs text-slate-600">
                Manage IVR hospital routing and monitor inbound SMS booking records.
            </p>
            <div className="mb-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <label className="text-xs font-semibold text-slate-700">
                    Search SMS Booking Desk
                    <input
                        className="input mt-1"
                        placeholder="Search district, hospital, doctor, IVR number, sender, or message ref"
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                    />
                </label>
            </div>

            <div className="mb-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">IVR Menu Configuration (SMS Booking Control)</h3>
                <p className="mt-1 text-xs text-slate-600">
                    Auto-arranged district-wise: `districtOrder + hospitalOrder + doctorOrder` (example: 111, 112, 3811).
                </p>
                <div className="mt-2 flex justify-end">
                    <button type="button" className="btn-primary" onClick={() => void onSaveIvrMenu()} disabled={isSavingMenu}>
                        {isSavingMenu ? "Saving..." : "Save IVR Menu"}
                    </button>
                </div>

                <div className="mt-3 space-y-3">
                    {filteredDistrictGroups.map((group) => (
                        <div key={group.district} className="rounded-lg border border-slate-200 bg-white p-2">
                            <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                                District: {group.district}
                            </p>
                            <div className="space-y-2">
                                {group.hospitals.map((hospitalGroup) => (
                                    <div key={`${group.district}-${hospitalGroup.hospital}`} className="rounded-md border border-slate-200 bg-slate-50 p-2">
                                        <p className="mb-2 text-xs font-semibold text-slate-700">
                                            Hospital: {hospitalGroup.hospital} ({hospitalGroup.rows.length} doctor{hospitalGroup.rows.length > 1 ? "s" : ""})
                                        </p>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-left text-xs text-slate-700">
                                                <thead className="text-slate-900">
                                                    <tr>
                                                        <th className="px-2 py-1">IVR Number (district-wise)</th>
                                                        <th className="px-2 py-1">Doctor</th>
                                                        <th className="px-2 py-1">Priority</th>
                                                        <th className="px-2 py-1">Active</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {hospitalGroup.rows.map(({ row, index }) => (
                                                        <tr key={`${row.doctorId ?? row.digit}-${index}`} className="border-t border-slate-200">
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    className="input"
                                                                    value={row.digit}
                                                                    readOnly
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <div className="rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700">
                                                                    {row.doctorName ?? row.doctorId ?? "N/A"}
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    className="input"
                                                                    type="number"
                                                                    min={1}
                                                                    value={row.priority}
                                                                    onChange={(event) => onUpdateMenuRow(index, { priority: Number(event.target.value) || 1 })}
                                                                />
                                                            </td>
                                                            <td className="px-2 py-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={row.active}
                                                                    onChange={(event) => onUpdateMenuRow(index, { active: event.target.checked })}
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filteredDistrictGroups.length === 0 && (
                        <p className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                            No IVR mappings match this search.
                        </p>
                    )}
                </div>
                {ivrStatusText && <p className="mt-2 text-xs text-slate-700">{ivrStatusText}</p>}
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="mb-2 text-xs font-semibold text-slate-800">Recent SMS booking records</p>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs text-slate-700">
                        <thead className="text-slate-900">
                            <tr>
                                <th className="px-2 py-1">Message Ref</th>
                                <th className="px-2 py-1">Sender</th>
                                <th className="px-2 py-1">IVR Number</th>
                                <th className="px-2 py-1">Hospital</th>
                                <th className="px-2 py-1">Doctor</th>
                                <th className="px-2 py-1">Appointment</th>
                                <th className="px-2 py-1">SMS</th>
                                <th className="px-2 py-1">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSmsBookings.map((entry) => (
                                <tr key={entry.id} className="border-t border-slate-200">
                                    <td className="px-2 py-1">{entry.smsMessageId}</td>
                                    <td className="px-2 py-1">{entry.normalizedSenderPhone || entry.senderPhone}</td>
                                    <td className="px-2 py-1">{entry.parsedCommand || "-"}</td>
                                    <td className="px-2 py-1">{entry.selectedHospitalName || "-"}</td>
                                    <td className="px-2 py-1">{entry.doctorName || entry.doctorId || "-"}</td>
                                    <td className="px-2 py-1">{entry.appointmentId ? `#${entry.tokenNumber ?? "?"} ${entry.slot ?? ""}` : "Not created"}</td>
                                    <td className="px-2 py-1">{entry.smsStatus ?? "not_sent"}</td>
                                    <td className="px-2 py-1">{entry.status}</td>
                                </tr>
                            ))}
                            {recentSmsBookings.length === 0 && (
                                <tr className="border-t border-slate-200">
                                    <td className="px-2 py-2 text-slate-500" colSpan={8}>
                                        No SMS booking records yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
    );
};
