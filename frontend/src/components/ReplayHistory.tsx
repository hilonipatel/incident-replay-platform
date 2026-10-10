import { useEffect, useMemo, useState } from "react";
import {
  getReplayHistory,
  getReplayResults,
  type ReplayRun,
  type ReplayResult,
} from "../services/api";
import "./ReplayHistory.css";

interface ReplayHistoryProps {
  incidentId: string | number;
  currentReplay: ReplayRun | null;
  onOpenReplay?: (replay: ReplayRun) => void;
}

function passRate(replay: ReplayRun): number {
  return replay.total === 0
    ? 0
    : Math.round((replay.passed / replay.total) * 100);
}

function compareResults(
  previous: ReplayResult[],
  current: ReplayResult[]
) {
  const previousByEvent = new Map(
    previous.map((item) => [String(item.eventId), item])
  );

  return current.map((item) => {
    const old = previousByEvent.get(String(item.eventId));

    if (!old) {
      return {
        key: String(item.eventId),
        sequence: item.sequenceNumber,
        path: item.path,
        before: "N/A",
        after: item.result,
        change: "new" as const,
      };
    }

    let change:
      | "improved"
      | "regressed"
      | "unchanged"
      | "changed";

    if (old.result === "FAIL" && item.result === "PASS") {
      change = "improved";
    } else if (
      old.result === "PASS" &&
      item.result === "FAIL"
    ) {
      change = "regressed";
    } else if (
      old.result === item.result &&
      old.actualStatus === item.actualStatus &&
      JSON.stringify(old.actualResponseBody) ===
        JSON.stringify(item.actualResponseBody)
    ) {
      change = "unchanged";
    } else {
      change = "changed";
    }

    return {
      key: String(item.eventId),
      sequence: item.sequenceNumber,
      path: item.path,
      before: old.result,
      after: item.result,
      change,
    };
  });
}

export default function ReplayHistory({
  incidentId,
  currentReplay,
  onOpenReplay,
}: ReplayHistoryProps) {
  const [history, setHistory] = useState<ReplayRun[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedReplay, setSelectedReplay] =
    useState<ReplayRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonLoading, setComparisonLoading] =
    useState(false);
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError("");

      try {
        const runs = await getReplayHistory(incidentId);

        if (cancelled) return;

        const allRuns = currentReplay
          ? [
              currentReplay,
              ...runs.filter(
                (run) =>
                  String(run.replayId) !==
                  String(currentReplay.replayId)
              ),
            ]
          : runs;

        setHistory(allRuns);
        setSelectedId((previous) =>
          allRuns.some(
            (run) =>
              String(run.replayId) === String(previous)
          )
            ? previous
            : ""
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load replay history."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [incidentId, currentReplay?.replayId]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedReplay() {
      if (
        !selectedId ||
        String(selectedId) ===
          String(currentReplay?.replayId ?? "")
      ) {
        setSelectedReplay(null);
        setComparisonLoading(false);
        return;
      }

      setComparisonLoading(true);
      setSelectedReplay(null);

      try {
        const replay = await getReplayResults(
          incidentId,
          selectedId
        );

        if (!cancelled) {
          setSelectedReplay(replay);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the selected replay."
          );
        }
      } finally {
        if (!cancelled) {
          setComparisonLoading(false);
        }
      }
    }

    void loadSelectedReplay();

    return () => {
      cancelled = true;
    };
  }, [incidentId, selectedId, currentReplay?.replayId]);

  const comparisonTarget = currentReplay ?? history[0] ?? null;

  const baseline =
    selectedReplay &&
    String(selectedReplay.replayId) !==
      String(comparisonTarget?.replayId ?? "")
      ? selectedReplay
      : null;

  const comparisons = useMemo(() => {
    if (!baseline || !comparisonTarget) return [];

    return compareResults(
      baseline.results,
      comparisonTarget.results
    );
  }, [baseline, comparisonTarget]);

  return (
    <section className="replay-history">
      <div className="replay-history-heading">
        <button
            type="button"
            className="history-collapse-toggle"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((expanded) => !expanded)}
        >
            <span className="history-section-number">02 /</span>

            <span className="history-heading-content">
            <span className="history-section-title">
                Replay history
            </span>

            <span className="history-section-description">
                Track failures and verify fixes across replay runs.
            </span>
            </span>

            <span className="history-collapse-icon" aria-hidden="true">
            {isExpanded ? "▾" : "▸"}
            </span>
        </button>

        <span className="history-count">
            {loading
            ? "Loading…"
            : `${history.length} ${
                history.length === 1 ? "run" : "runs"
                }`}
        </span>
        </div>

      {isExpanded && (
        <div className="history-expanded-content">
          {error && (
            <p className="history-error" role="alert">
              {error}
            </p>
          )}

          {!loading && !error && history.length === 0 && (
            <p className="history-empty">
              No previous replay runs were found for this incident.
            </p>
          )}

          {history.length > 0 && (
            <div className="history-list">
              {history.map((run) => {
                const isCurrent =
                  String(run.replayId) ===
                  String(comparisonTarget?.replayId ?? "");

                const isSelected =
                  selectedId === String(run.replayId);

                return (
                  <div
                    key={run.replayId}
                    className="history-run-wrapper"
                  >
                    <article
                      className={`history-run ${
                        isCurrent ? "history-run-current" : ""
                      }`}
                    >
                      <div className="history-run-main">
                        <div className="history-run-title">
                          <strong>
                            Replay #{run.replayId}
                          </strong>

                          {isCurrent && (
                            <span className="history-current-tag">
                              Latest
                            </span>
                          )}
                        </div>

                        <div className="history-run-meta">
                          <span>{run.total} requests</span>
                          <span>{run.passed} passed</span>
                          <span>{run.failed} failed</span>
                        </div>

                        <div className="history-progress">
                          <div
                            className="history-progress-fill"
                            style={{
                              width: `${passRate(run)}%`,
                            }}
                          />
                        </div>

                        <span className="history-pass-rate">
                          {passRate(run)}% pass rate
                        </span>
                      </div>

                      <div className="history-run-actions">
                        <span
                          className={`history-status ${
                            run.failed === 0
                              ? "history-status-pass"
                              : "history-status-fail"
                          }`}
                        >
                          {run.failed === 0 ? "PASS" : "FAIL"}
                        </span>

                        {isCurrent ? (
                          <button type="button" disabled>
                            Latest run
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={comparisonLoading}
                            onClick={() => {
                              setError("");
                              setSelectedId(String(run.replayId));
                              onOpenReplay?.(run);
                            }}
                          >
                            {comparisonLoading && isSelected
                              ? "Loading…"
                              : isSelected && baseline
                                ? "Comparing"
                                : "Compare"}
                          </button>
                        )}
                      </div>
                    </article>

                    {baseline &&
                      comparisonTarget &&
                      isSelected && (
                        <section className="history-comparison">
                          <h3>
                            Replay #{baseline.replayId} vs. #
                            {comparisonTarget.replayId}
                          </h3>

                          <div className="history-comparison-summary">
                            <div>
                              <span>Baseline pass rate</span>
                              <strong>{passRate(baseline)}%</strong>
                            </div>

                            <div>
                              <span>Latest pass rate</span>
                              <strong>
                                {passRate(comparisonTarget)}%
                              </strong>
                            </div>

                            <div>
                              <span>Pass rate change</span>
                              <strong>
                                {passRate(comparisonTarget) -
                                  passRate(baseline) >
                                0
                                  ? "+"
                                  : ""}
                                {passRate(comparisonTarget) -
                                  passRate(baseline)}
                                %
                              </strong>
                            </div>
                          </div>

                          {comparisonLoading ? (
                            <p>Loading comparison…</p>
                          ) : comparisons.length === 0 ? (
                            <p className="history-empty">
                              No event comparisons are available.
                            </p>
                          ) : (
                            <div className="history-comparison-table-wrapper">
                              <table className="history-comparison-table">
                                <thead>
                                  <tr>
                                    <th>Event</th>
                                    <th>Endpoint</th>
                                    <th>Baseline</th>
                                    <th>Latest</th>
                                    <th>Change</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {comparisons.map((item) => (
                                    <tr key={item.key}>
                                      <td>
                                        {String(item.sequence).padStart(
                                          2,
                                          "0"
                                        )}
                                      </td>
                                      <td>
                                        <code>{item.path}</code>
                                      </td>
                                      <td>{item.before}</td>
                                      <td>{item.after}</td>
                                      <td>
                                        <span
                                          className={`history-change history-change-${item.change}`}
                                        >
                                          {item.change}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </section>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}