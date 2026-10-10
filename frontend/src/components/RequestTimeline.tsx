import { useMemo, useState } from "react";
import ResponseDiffViewer from "./ResponseDiffViewer";
import "./RequestTimeline.css";

export interface RequestTimelineEvent {
  sequenceNumber: number;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number | null;
  result: "PASS" | "FAIL";
  durationMs: number;
  expectedResponseBody?: unknown;
  actualResponseBody?: unknown;
  errorMessage?: string | null;
}

interface RequestTimelineProps {
  results: RequestTimelineEvent[];
}

type FailureKind =
  | "status"
  | "body"
  | "execution"
  | "unknown";

function getFailureKind(
  event: RequestTimelineEvent
): FailureKind | "pass" {
  if (event.result === "PASS") {
    return "pass";
  }

  if (event.errorMessage) {
    return "execution";
  }

  if (event.actualStatus === null) {
    return "execution";
  }

  if (event.actualStatus !== event.expectedStatus) {
    return "status";
  }

  if (
    event.expectedResponseBody !== undefined &&
    event.actualResponseBody !== undefined
  ) {
    return "body";
  }

  return "unknown";
}

function getFailureLabel(
  kind: FailureKind | "pass"
): string {
  switch (kind) {
    case "pass":
      return "Passed";
    case "status":
      return "HTTP status mismatch";
    case "body":
      return "Response body mismatch";
    case "execution":
      return "Request execution error";
    default:
      return "Replay validation failed";
  }
}

function getFailureDescription(
  event: RequestTimelineEvent,
  kind: FailureKind | "pass"
): string {
  switch (kind) {
    case "pass":
      return "The replay event passed validation.";
    case "status":
      return (
        `Expected HTTP ${event.expectedStatus}, ` +
        `but received HTTP ${event.actualStatus}.`
      );
    case "execution":
      return (
        event.errorMessage ||
        "No HTTP response was received for this request."
      );
    case "body":
      return (
        "The HTTP status matched, but the response body " +
        "differs from the expected response."
      );
    default:
      return (
        "The replay event failed. Expand the event to inspect " +
        "the available request and response diagnostics."
      );
  }
}

function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "—";
  }

  if (durationMs < 1) {
    return `${durationMs.toFixed(2)} ms`;
  }

  if (durationMs < 1000) {
    return `${durationMs.toFixed(1)} ms`;
  }

  return `${(durationMs / 1000).toFixed(2)} s`;
}

export default function RequestTimeline({
  results,
}: RequestTimelineProps) {
  const [expandedEvents, setExpandedEvents] = useState<
    Set<number>
  >(() => new Set());

  const events = useMemo(
    () =>
      [...results].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber
      ),
    [results]
  );

  const firstFailedSequence = useMemo(
    () =>
      events.find((event) => event.result === "FAIL")
        ?.sequenceNumber ?? null,
    [events]
  );

  const passedCount = events.filter(
    (event) => event.result === "PASS"
  ).length;

  const failedCount = events.length - passedCount;

  function toggleEvent(sequenceNumber: number) {
    setExpandedEvents((current) => {
      const next = new Set(current);

      if (next.has(sequenceNumber)) {
        next.delete(sequenceNumber);
      } else {
        next.add(sequenceNumber);
      }

      return next;
    });
  }

  if (events.length === 0) {
    return (
      <section className="request-timeline">
        <div className="request-timeline-empty">
          <strong>No replay events yet</strong>
          <p>
            Run a replay to see request execution order,
            durations, and response diagnostics.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="request-timeline">
      <div className="timeline-summary">
        <span className="timeline-summary-pass">
          {passedCount} passed
        </span>
  
        <span className="timeline-summary-fail">
          {failedCount} failed
        </span>
      </div>
  
      <ol className="timeline-list">
        {events.map((event, index) => {
          const kind = getFailureKind(event);
          const isFirstFailure =
            event.sequenceNumber === firstFailedSequence;
          const isExpanded = expandedEvents.has(
            event.sequenceNumber
          );

          return (
            <li
              key={`${event.sequenceNumber}-${event.method}-${event.path}`}
              className={[
                "timeline-item",
                event.result === "PASS"
                  ? "timeline-item-pass"
                  : "timeline-item-fail",
                isFirstFailure
                  ? "timeline-item-first-failure"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="timeline-rail">
                <span
                  className={`timeline-marker ${
                    event.result === "PASS"
                      ? "timeline-marker-pass"
                      : "timeline-marker-fail"
                  }`}
                  aria-label={
                    event.result === "PASS"
                      ? "Passed"
                      : "Failed"
                  }
                >
                  {event.result === "PASS" ? "✓" : "!"}
                </span>

                {index < events.length - 1 && (
                  <span className="timeline-connector" />
                )}
              </div>

              <div className="timeline-event">
                <button
                  type="button"
                  className="timeline-event-toggle"
                  onClick={() =>
                    toggleEvent(event.sequenceNumber)
                  }
                  aria-expanded={isExpanded}
                >
                  <div className="timeline-event-main">
                    <div className="timeline-event-topline">
                      <span className="timeline-sequence">
                        {String(event.sequenceNumber).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <span className="timeline-method">
                        {event.method}
                      </span>

                      <span
                        className="timeline-path"
                        title={event.path}
                      >
                        {event.path}
                      </span>
                    </div>

                    <div className="timeline-event-meta">
                      <span
                        className={`timeline-result ${
                          event.result === "PASS"
                            ? "timeline-result-pass"
                            : "timeline-result-fail"
                        }`}
                      >
                        {event.result}
                      </span>

                      <span className="timeline-duration">
                        {formatDuration(event.durationMs)}
                      </span>

                      <span className="timeline-http">
                        HTTP{" "}
                        {event.actualStatus ?? "No response"}
                      </span>
                    </div>
                  </div>

                  <span
                    className="timeline-chevron"
                    aria-hidden="true"
                  >
                    {isExpanded ? "−" : "+"}
                  </span>
                </button>

                {isFirstFailure && (
                  <div className="timeline-first-failure-label">
                    First failing event
                  </div>
                )}

                {event.result === "FAIL" && (
                  <div className="timeline-diagnosis">
                    <strong>{getFailureLabel(kind)}</strong>
                    <p>{getFailureDescription(event, kind)}</p>
                  </div>
                )}

                {isExpanded && (
                  <div className="timeline-details">
                    <div className="timeline-status-grid">
                      <div>
                        <span>Expected HTTP</span>
                        <strong>{event.expectedStatus}</strong>
                      </div>

                      <div>
                        <span>Actual HTTP</span>
                        <strong
                          className={
                            event.actualStatus ===
                            event.expectedStatus
                              ? "timeline-value-match"
                              : "timeline-value-mismatch"
                          }
                        >
                          {event.actualStatus ?? "No response"}
                        </strong>
                      </div>

                      <div>
                        <span>Duration</span>
                        <strong>
                          {formatDuration(event.durationMs)}
                        </strong>
                      </div>
                    </div>

                    {event.errorMessage && (
                      <div className="timeline-error">
                        <strong>Execution error</strong>
                        <p>{event.errorMessage}</p>
                      </div>
                    )}

                    <div className="timeline-response-diff">
                      <h4>Response diagnostics</h4>

                      <ResponseDiffViewer
                        expected={event.expectedResponseBody}
                        actual={event.actualResponseBody}
                        expectedStatus={event.expectedStatus}
                        actualStatus={event.actualStatus}
                        result={event.result}
                        errorMessage={event.errorMessage}
                      />
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}