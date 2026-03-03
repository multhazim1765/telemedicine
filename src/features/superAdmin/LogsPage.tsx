import { Accordion, AccordionDetails, AccordionSummary } from "@mui/material";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { subscribeCollection } from "../../services/firestoreService";
import { TriageSession } from "../../types/models";

export const LogsPage = () => {
  const [logs, setLogs] = useState<TriageSession[]>([]);

  useEffect(() => {
    const unsub = subscribeCollection("triage_sessions", setLogs);
    return unsub;
  }, []);

  return (
    <section className="rounded-2xl bg-white/80 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)] ring-1 ring-cyan-100 backdrop-blur-md">
      <h2 className="mb-3 text-base font-semibold text-slate-800">System Logs</h2>
      <div className="space-y-2">
        {logs.slice(0, 12).map((log) => (
          <motion.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Accordion>
              <AccordionSummary expandIcon={<ChevronDown className="h-4 w-4" />}>
                <p className="text-sm font-medium text-slate-700">{log.symptoms.join(", ").slice(0, 80)}</p>
              </AccordionSummary>
              <AccordionDetails>
                <p className="text-xs text-slate-600">Severity: {log.result.severityLevel}</p>
                <p className="text-xs text-slate-600">Action: {log.result.recommendedAction}</p>
                <p className="text-xs text-slate-500">Created: {log.createdAt}</p>
              </AccordionDetails>
            </Accordion>
          </motion.div>
        ))}
      </div>
    </section>
  );
};
