import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  getIncidents,
  createIncident,
  getIncidentEvents,
  createIncidentEvent,
  runIncidentReplay,
  getReplayResults,
  type Incident,
  type IncidentEvent,
  type CreateIncidentEventInput,
  type ReplayRun,
} from "./services/api";
import "./App.css";

type StatusFilter = "all" | "open" | "resolved";
type Severity = "low" | "medium" | "high" | "critical";

function normalize(value?: string) {
  return (value ?? "").toLowerCase().replace(/[_-]/g, " ");
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function severityClass(value?: string) {
  const severity = normalize(value);

  return ["critical", "high", "medium", "low"].includes(severity)
    ? severity
    : "unknown";
}

function statusClass(value?: string) {
  const status = normalize(value);

  return ["open", "resolved", "closed", "in progress"].includes(status)
    ? status.replace(/\s/g, "-")
    : "unknown";
}

function App() {
  // Incident list
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search and filtering
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");

  // Create incident
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSeverity, setNewSeverity] =
    useState<Severity>("medium");

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");

  // Selected incident and its events
  const [selectedIncident, setSelectedIncident] =
    useState<Incident | null>(null);

  const [incidentEvents, setIncidentEvents] =
    useState<IncidentEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");

  // Create HTTP event
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventSequence, setEventSequence] = useState("1");
  const [eventMethod, setEventMethod] =
    useState<CreateIncidentEventInput["method"]>("GET");
  const [eventPath, setEventPath] =
    useState("/api/demo/orders");
  const [eventExpectedStatus, setEventExpectedStatus] =
    useState("200");
  const [eventRequestBody, setEventRequestBody] = useState("");
  const [eventResponseBody, setEventResponseBody] = useState("");

  const [eventError, setEventError] = useState("");
  const [eventSaving, setEventSaving] = useState(false);

  // Incident Replay
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState("");
  const [replayRun, setReplayRun] = useState<ReplayRun | null>(null);

  async function handleRunReplay() {
    if (!selectedIncident || replaying) return;
  
    if (incidentEvents.length === 0) {
      setReplayError(
        "Add at least one HTTP event before running replay."
      );
      return;
    }
  
    setReplaying(true);
    setReplayError("");
    setReplayRun(null);
  
    try {
      const summary = await runIncidentReplay(
        selectedIncident.id
      );
  
      const details = await getReplayResults(
        selectedIncident.id,
        summary.replayId
      );
  
      setReplayRun(details);
    } catch (error) {
      setReplayError(
        error instanceof Error
          ? error.message
          : "Unable to run replay"
      );
    } finally {
      setReplaying(false);
    }
  } 

  // Load incidents
  const loadIncidents = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getIncidents();
      setIncidents(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load incidents."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  // Incident statistics
  const stats = useMemo(
    () => ({
      total: incidents.length,
      open: incidents.filter(
        (incident) => normalize(incident.status) === "open"
      ).length,
      resolved: incidents.filter((incident) =>
        ["resolved", "closed"].includes(
          normalize(incident.status)
        )
      ).length,
    }),
    [incidents]
  );

  // Search and status filtering
  const filteredIncidents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return incidents.filter((incident) => {
      const searchableValues = [
        incident.title,
        incident.description,
        incident.severity,
        incident.status,
        String(incident.id),
      ];

      const matchesSearch = searchableValues.some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      );

      const status = normalize(incident.status);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open" && status === "open") ||
        (statusFilter === "resolved" &&
          ["resolved", "closed"].includes(status));

      return matchesSearch && matchesStatus;
    });
  }, [incidents, search, statusFilter]);

  // Create incident
  async function handleCreateIncident(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (creating) return;

    setCreateError("");
    setCreateSuccess("");

    const title = newTitle.trim();
    const description = newDescription.trim();

    if (!title) {
      setCreateError("Title is required.");
      return;
    }

    if (title.length > 200) {
      setCreateError("Title must be 200 characters or fewer.");
      return;
    }

    setCreating(true);

    try {
      const createdIncident = await createIncident({
        title,
        description,
        severity: newSeverity,
      });

      // Add the new incident immediately.
      setIncidents((current) => {
        const alreadyExists = current.some(
          (incident) =>
            String(incident.id) === String(createdIncident.id)
        );

        if (alreadyExists) return current;

        return [createdIncident, ...current];
      });

      setNewTitle("");
      setNewDescription("");
      setNewSeverity("medium");
      setShowCreateForm(false);

      setCreateSuccess(
        `Incident "${createdIncident.title}" was created successfully.`
      );

      // Refresh the list from the backend.
      await loadIncidents();
    } catch (err) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create incident."
      );
    } finally {
      setCreating(false);
    }
  }

  function openCreateForm() {
    setCreateError("");
    setCreateSuccess("");
    setShowCreateForm((current) => !current);
  }

  // Open incident details and load recorded HTTP events.
  async function openIncidentDetails(incident: Incident) {
    setSelectedIncident(incident);
    setIncidentEvents([]);
    setEventsError("");
    setEventError("");
    setEventsLoading(true);
    setShowEventForm(false);
    setReplayRun(null);
    setReplayError("");
    setReplaying(false);

    // Reset the event form for the selected incident.
    setEventSequence("1");
    setEventMethod("GET");
    setEventPath("/api/demo/orders");
    setEventExpectedStatus("200");
    setEventRequestBody("");
    setEventResponseBody("");

    window.location.hash = `incident/${incident.id}`;

    try {
      const events = await getIncidentEvents(incident.id);

      setIncidentEvents(
        [...events].sort(
          (a, b) => a.sequence_number - b.sequence_number
        )
      );

      // Suggest the next sequence number.
      if (events.length > 0) {
        const nextSequence =
          Math.max(...events.map((item) => item.sequence_number)) + 1;

        setEventSequence(String(nextSequence));
      }
    } catch (err) {
      setEventsError(
        err instanceof Error
          ? err.message
          : "Unable to load incident events."
      );
    } finally {
      setEventsLoading(false);
    }
  }

  function closeIncidentDetails() {
    setSelectedIncident(null);
    setIncidentEvents([]);
    setEventsError("");
    setEventError("");
    setShowEventForm(false);
  
    setReplayRun(null);
    setReplayError("");
  
    window.location.hash = "incidents";
  }

  // Create an HTTP event for the selected incident.
  async function handleCreateEvent(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedIncident || eventSaving) return;

    setEventError("");

    const sequenceNumber = Number(eventSequence);
    const expectedStatus = Number(eventExpectedStatus);
    const path = eventPath.trim();

    if (!Number.isInteger(sequenceNumber) || sequenceNumber < 1) {
      setEventError(
        "Sequence number must be a positive integer."
      );
      return;
    }

    if (
      !Number.isInteger(expectedStatus) ||
      expectedStatus < 100 ||
      expectedStatus > 599
    ) {
      setEventError(
        "Expected status must be between 100 and 599."
      );
      return;
    }

    if (!/^\/api\/demo\/[a-zA-Z0-9/_-]*$/.test(path)) {
      setEventError(
        "Request path must start with /api/demo/ and contain only valid path characters."
      );
      return;
    }

    // Optional JSON fields are omitted when empty.
    function parseOptionalJson(value: string): unknown {
      if (!value.trim()) return undefined;
      return JSON.parse(value);
    }

    let requestBody: unknown;
    let expectedResponseBody: unknown;

    try {
      requestBody = parseOptionalJson(eventRequestBody);
      expectedResponseBody = parseOptionalJson(eventResponseBody);
    } catch {
      setEventError(
        "Request and response bodies must contain valid JSON."
      );
      return;
    }

    const input: CreateIncidentEventInput = {
      sequenceNumber,
      method: eventMethod,
      path,
      expectedStatus,
      ...(requestBody !== undefined ? { requestBody } : {}),
      ...(expectedResponseBody !== undefined
        ? { expectedResponseBody }
        : {}),
    };

    setEventSaving(true);

    try {
      const createdEvent = await createIncidentEvent(
        selectedIncident.id,
        input
      );

      setIncidentEvents((current) =>
        [...current, createdEvent].sort(
          (a, b) => a.sequence_number - b.sequence_number
        )
      );

      setEventSequence(String(sequenceNumber + 1));
      setEventRequestBody("");
      setEventResponseBody("");
      setShowEventForm(false);
      setEventError("");
    } catch (err) {
      setEventError(
        err instanceof Error
          ? err.message
          : "Failed to create HTTP event."
      );
    } finally {
      setEventSaving(false);
    }
  }

  return (
    <div className="retrace-shell">
      <aside className="sidebar">
        <a
          className="wordmark"
          href="#incidents"
          aria-label="RETRACE home"
          onClick={() => {
            if (selectedIncident) closeIncidentDetails();
          }}
        >
          <span className="wordmark-symbol">
            <span />
            <span />
            <span />
          </span>
          <span className="wordmark-text">RETRACE</span>
        </a>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <a
            className={`nav-link${selectedIncident ? "" : " active"}`}
            href="#incidents"
            aria-current={selectedIncident ? undefined : "page"}
            onClick={() => {
              if (selectedIncident) closeIncidentDetails();
            }}
          >
            <span className="nav-indicator" />
            <span className="nav-icon">01</span>
            Incidents
            <span className="nav-count">{incidents.length}</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="environment-label">
            <span className="environment-dot" />
            <span>LOCAL ENVIRONMENT</span>
          </div>

          <div className="sidebar-version">
            INCIDENT REPLAY WORKBENCH
          </div>
        </div>
      </aside>

      <main className="main-content" id="incidents">
        <header className="context-bar">
          <div className="context-breadcrumb">
            WORKSPACE <span>/</span>{" "}
            <strong>
              {selectedIncident ? "INCIDENT DETAILS" : "INCIDENTS"}
            </strong>
          </div>

          <button
            type="button"
            className="icon-button refresh-button"
            onClick={() => {
              if (selectedIncident) {
                void openIncidentDetails(selectedIncident);
              } else {
                void loadIncidents();
              }
            }}
            disabled={loading || eventsLoading}
            aria-label="Refresh data"
            title="Refresh data"
          >
            <span
              className={
                loading || eventsLoading
                  ? "refresh-symbol is-loading"
                  : "refresh-symbol"
              }
            >
              ↻
            </span>
            <span>Refresh</span>
          </button>
        </header>

        {/* Incident details */}
        {selectedIncident ? (
          <section className="incident-details-page">
            <div className="details-page-header">
              <div className="details-heading-copy">
                <div className="section-index">
                  INCIDENT DETAILS / INC-
                  {String(selectedIncident.id).padStart(3, "0")}
                </div>

                <h1>{selectedIncident.title}</h1>

                <p className="details-description">
                  {selectedIncident.description ||
                    "No description provided."}
                </p>

                <div className="details-badges">
                  <span
                    className={`severity-indicator severity-${severityClass(
                      selectedIncident.severity
                    )}`}
                  >
                    <span className="severity-dot" />
                    {selectedIncident.severity || "Unknown"}
                  </span>

                  <span
                    className={`status-badge status-${statusClass(
                      selectedIncident.status
                    )}`}
                  >
                    {selectedIncident.status || "Unknown"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={closeIncidentDetails}
              >
                ← Back to incidents
              </button>
            </div>

            <div className="details-grid">
              <div className="details-card">
                <span className="details-card-label">INCIDENT ID</span>
                <strong>
                  INC-{String(selectedIncident.id).padStart(3, "0")}
                </strong>
              </div>

              <div className="details-card">
                <span className="details-card-label">STATUS</span>
                <strong>{selectedIncident.status || "Unknown"}</strong>
              </div>

              <div className="details-card">
                <span className="details-card-label">SEVERITY</span>
                <strong>{selectedIncident.severity || "Unknown"}</strong>
              </div>

              <div className="details-card">
                <span className="details-card-label">EVENTS</span>
                <strong>
                  {eventsLoading ? "—" : incidentEvents.length}
                </strong>
              </div>
            </div>

            <section className="replay-panel details-replay-panel">
              <div className="details-section-heading">
                <div>
                  <div className="section-index">01 / EXECUTION</div>
                  <h2>HTTP Event Replay</h2>
                  <p>
                    Execute recorded requests in sequence and compare
                    actual responses with expected results.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleRunReplay()}
                  disabled={
                    replaying ||
                    eventsLoading ||
                    incidentEvents.length === 0
                  }
                >
                  {replaying ? "Running replay..." : "▶ Run Replay"}
                </button>
              </div>

              {replayError && (
                <div className="create-error" role="alert">
                  <strong>Replay failed</strong>
                  <p>{replayError}</p>
                </div>
              )}

              {replayRun && (
                <section className="replay-report" aria-label="Replay report">
                  {/* Report header */}
                  <div className="replay-report-header">
                    <div>
                      <div className="section-index">02 / REPORT</div>
                      <h3 className="replay-report-title">Replay Results</h3>
                      <p className="replay-report-subtitle">
                        Review response differences and identify failed requests.
                      </p>
                    </div>

                    <span
                      className={`replay-run-status replay-run-status--${replayRun.status}`}
                    >
                      <span className="replay-run-status-dot" />
                      {replayRun.status}
                    </span>
                  </div>

                  {/* Summary cards */}
                  <div className="replay-summary-grid">
                    <div className="replay-summary-card">
                      <span className="replay-summary-label">TOTAL REQUESTS</span>
                      <strong className="replay-summary-value">
                        {replayRun.total}
                      </strong>
                      <span className="replay-summary-caption">
                        Requests executed
                      </span>
                    </div>

                    <div className="replay-summary-card replay-summary-card--passed">
                      <span className="replay-summary-label">PASSED</span>
                      <strong className="replay-summary-value">
                        {replayRun.passed}
                      </strong>
                      <span className="replay-summary-caption">
                        Responses matched
                      </span>
                    </div>

                    <div className="replay-summary-card replay-summary-card--failed">
                      <span className="replay-summary-label">FAILED</span>
                      <strong className="replay-summary-value">
                        {replayRun.failed}
                      </strong>
                      <span className="replay-summary-caption">
                        Require investigation
                      </span>
                    </div>

                    <div className="replay-summary-card">
                      <span className="replay-summary-label">PASS RATE</span>
                      <strong className="replay-summary-value">
                        {replayRun.total > 0
                          ? `${Math.round(
                              (replayRun.passed / replayRun.total) * 100
                            )}%`
                          : "—"}
                      </strong>
                      <div
                        className="replay-pass-track"
                        role="progressbar"
                        aria-label="Replay pass rate"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={
                          replayRun.total > 0
                            ? Math.round(
                                (replayRun.passed / replayRun.total) * 100
                              )
                            : 0
                        }
                      >
                        <span
                          className="replay-pass-track-fill"
                          style={{
                            width:
                              replayRun.total > 0
                                ? `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      (replayRun.passed / replayRun.total) * 100
                                    )
                                  )}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Results table */}
                  <div className="replay-results-heading">
                    <div>
                      <h4>Request breakdown</h4>
                      <p>
                        Expected and actual responses for each recorded event.
                      </p>
                    </div>

                    <span className="replay-result-count">
                      {(replayRun.results ?? []).length} events
                    </span>
                  </div>

                  {!replayRun.results || replayRun.results.length === 0 ? (
                    <div className="replay-empty-state">
                      <span className="replay-empty-icon" aria-hidden="true">
                        ∅
                      </span>
                      <h4>No replay results</h4>
                      <p>
                        No request results are available for this replay.
                      </p>
                    </div>
                  ) : (
                    <div className="table-scroll replay-table-scroll">
                      <table className="incident-table replay-results-table">
                        <thead>
                          <tr>
                            <th scope="col">STEP</th>
                            <th scope="col">REQUEST</th>
                            <th scope="col">EXPECTED</th>
                            <th scope="col">ACTUAL</th>
                            <th scope="col">EXPECTED BODY</th>
                            <th scope="col">ACTUAL BODY</th>
                            <th scope="col">DURATION</th>
                            <th scope="col">RESULT</th>
                          </tr>
                        </thead>

                        <tbody>
                          {replayRun.results.map((result, index) => {
                            const passed = result.result === "PASS";

                            const statusMatches =
                              result.actualStatus === result.expectedStatus;

                            const bodyMatches =
                              JSON.stringify(result.expectedResponseBody ?? null) ===
                              JSON.stringify(result.actualResponseBody ?? null);

                            const failureReason =
                              result.errorMessage ||
                              (!statusMatches
                                ? `Expected HTTP ${result.expectedStatus}, received ${
                                    result.actualStatus ?? "no response"
                                  }.`
                                : !bodyMatches
                                  ? "The actual response body differs from the expected body."
                                  : "The request did not pass replay validation.");

                            return (
                              <tr
                                key={`${replayRun.replayId}-${result.eventId}`}
                                className={
                                  passed
                                    ? "replay-row replay-row--passed"
                                    : "replay-row replay-row--failed"
                                }
                              >
                                <td>
                                  <span className="replay-step-number">
                                    {String(result.sequenceNumber).padStart(2, "0")}
                                  </span>
                                </td>

                                <td className="replay-request-cell">
                                  <span
                                    className={`replay-method replay-method--${result.method.toLowerCase()}`}
                                  >
                                    {result.method}
                                  </span>
                                  <code className="replay-request-path">
                                    {result.path}
                                  </code>
                                </td>

                                <td>
                                  <span className="replay-http-code">
                                    {result.expectedStatus}
                                  </span>
                                </td>

                                <td>
                                  <span
                                    className={`replay-http-code ${
                                      statusMatches
                                        ? "replay-http-code--match"
                                        : "replay-http-code--mismatch"
                                    }`}
                                  >
                                    {result.actualStatus ?? "No response"}
                                  </span>
                                  {!statusMatches && (
                                    <span className="replay-difference-label">
                                      Status mismatch
                                    </span>
                                  )}
                                </td>

                                <td>
                                  <pre className="replay-json">
                                    {result.expectedResponseBody == null
                                      ? "—"
                                      : JSON.stringify(
                                          result.expectedResponseBody,
                                          null,
                                          2
                                        )}
                                  </pre>
                                </td>

                                <td>
                                  <pre
                                    className={`replay-json ${
                                      !bodyMatches
                                        ? "replay-json--mismatch"
                                        : ""
                                    }`}
                                  >
                                    {result.actualResponseBody == null
                                      ? "—"
                                      : JSON.stringify(
                                          result.actualResponseBody,
                                          null,
                                          2
                                        )}
                                  </pre>

                                  {!bodyMatches && (
                                    <span className="replay-difference-label">
                                      Body mismatch
                                    </span>
                                  )}
                                </td>

                                <td>
                                  <span className="replay-duration">
                                    {result.durationMs} ms
                                  </span>
                                </td>

                                <td className="replay-result-cell">
                                  <span
                                    className={`replay-result-badge ${
                                      passed
                                        ? "replay-result-badge--passed"
                                        : "replay-result-badge--failed"
                                    }`}
                                  >
                                    <span aria-hidden="true">
                                      {passed ? "✓" : "!"}
                                    </span>
                                    {result.result}
                                  </span>

                                  {!passed && (
                                    <p className="replay-failure-reason">
                                      {failureReason}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Report footer */}
                  {replayRun.results && replayRun.results.length > 0 && (
                    <div className="replay-report-footer">
                      <span>
                        <span className="replay-footer-dot" />
                        Replay ID: {replayRun.replayId}
                      </span>
                      <span>
                        {replayRun.failed === 0
                          ? "All requests passed validation."
                          : `${replayRun.failed} request${
                              replayRun.failed === 1 ? "" : "s"
                            } need investigation.`}
                      </span>
                    </div>
                  )}
                </section>
              )}
            </section>

            <section className="incident-section details-events-section">
              <div className="details-section-heading">
                <div>
                  <div className="section-index">03 / REQUEST SEQUENCE</div>
                  <h2>Recorded HTTP events</h2>
                  <p>
                    Review the requests associated with this incident.
                  </p>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    setEventError("");
                    setShowEventForm((current) => !current);
                  }}
                  disabled={eventSaving || eventsLoading}
                  aria-expanded={showEventForm}
                >
                  {showEventForm ? "Cancel" : "+ Add HTTP Event"}
                </button>
              </div>

              {eventsError && (
                <div className="create-error" role="alert">
                  <strong>Unable to load HTTP events</strong>
                  <p>{eventsError}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void openIncidentDetails(selectedIncident)}
                  >
                    Retry
                  </button>
                </div>
              )}

              {eventsLoading ? (
                <div className="state-panel" role="status">
                  <h3>Loading HTTP events</h3>
                  <p>Waiting for the backend response.</p>
                </div>
              ) : (
                <>
                  {showEventForm && (
                    <form
                      className="create-form"
                      onSubmit={handleCreateEvent}
                    >
                      <div className="form-field">
                        <label htmlFor="event-sequence">
                          Sequence number *
                        </label>
                        <input
                          id="event-sequence"
                          name="sequenceNumber"
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={eventSequence}
                          onChange={(event) =>
                            setEventSequence(event.target.value)
                          }
                          disabled={eventSaving}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="event-method">HTTP method *</label>
                        <select
                          id="event-method"
                          name="method"
                          required
                          value={eventMethod}
                          onChange={(event) =>
                            setEventMethod(
                              event.target.value as CreateIncidentEventInput["method"]
                            )
                          }
                          disabled={eventSaving}
                        >
                          {["GET", "POST", "PUT", "PATCH", "DELETE"].map(
                            (method) => (
                              <option key={method} value={method}>
                                {method}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="form-field">
                        <label htmlFor="event-path">Request path *</label>
                        <input
                          id="event-path"
                          name="path"
                          required
                          value={eventPath}
                          onChange={(event) =>
                            setEventPath(event.target.value)
                          }
                          pattern="/api/demo/[a-zA-Z0-9/_-]*"
                          title="Use a path beginning with /api/demo/"
                          placeholder="/api/demo/orders"
                          disabled={eventSaving}
                        />
                        <span className="field-hint">
                          Must start with /api/demo/
                        </span>
                      </div>

                      <div className="form-field">
                        <label htmlFor="event-status">
                          Expected HTTP status *
                        </label>
                        <input
                          id="event-status"
                          name="expectedStatus"
                          type="number"
                          min="100"
                          max="599"
                          step="1"
                          required
                          value={eventExpectedStatus}
                          onChange={(event) =>
                            setEventExpectedStatus(event.target.value)
                          }
                          disabled={eventSaving}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="event-request-body">
                          Request body (JSON, optional)
                        </label>
                        <textarea
                          id="event-request-body"
                          name="requestBody"
                          value={eventRequestBody}
                          onChange={(event) =>
                            setEventRequestBody(event.target.value)
                          }
                          placeholder={'{"orderId":123}'}
                          rows={4}
                          disabled={eventSaving}
                        />
                      </div>

                      <div className="form-field">
                        <label htmlFor="event-response-body">
                          Expected response body (JSON, optional)
                        </label>
                        <textarea
                          id="event-response-body"
                          name="expectedResponseBody"
                          value={eventResponseBody}
                          onChange={(event) =>
                            setEventResponseBody(event.target.value)
                          }
                          placeholder={'{"success":true}'}
                          rows={4}
                          disabled={eventSaving}
                        />
                      </div>

                      {eventError && (
                        <div className="create-error" role="alert">
                          <strong>HTTP event not saved</strong>
                          <p>{eventError}</p>
                        </div>
                      )}

                      <div className="create-form-actions">
                        <span className="required-note">
                          * Required field
                        </span>

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setShowEventForm(false);
                            setEventError("");
                          }}
                          disabled={eventSaving}
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="primary-button"
                          disabled={eventSaving}
                        >
                          {eventSaving ? "Saving event..." : "Save HTTP Event"}
                        </button>
                      </div>
                    </form>
                  )}

                  {incidentEvents.length === 0 ? (
                    <div className="state-panel">
                      <h3>No HTTP events recorded</h3>
                      <p>
                        Add an HTTP event to begin recording this
                        incident&apos;s request sequence.
                      </p>
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table className="incident-table">
                        <thead>
                          <tr>
                            <th scope="col">SEQUENCE</th>
                            <th scope="col">METHOD</th>
                            <th scope="col">PATH</th>
                            <th scope="col">EXPECTED STATUS</th>
                            <th scope="col">CREATED</th>
                          </tr>
                        </thead>

                        <tbody>
                          {incidentEvents.map((item) => (
                            <tr key={item.id}>
                              <td>
                                {String(item.sequence_number).padStart(2, "0")}
                              </td>
                              <td>
                                <span className="http-method-badge">
                                  {item.method}
                                </span>
                              </td>
                              <td>
                                <code className="event-path">
                                  {item.path}
                                </code>
                              </td>
                              <td>{item.expected_status}</td>
                              <td>{formatDate(item.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          </section>
        ) : (
          <>
            {/* Incident queue */}
            <section className="page-intro">
              <div className="page-heading-copy">
                <div className="eyebrow">
                  <span className="eyebrow-line" />
                  INCIDENT QUEUE
                </div>

                <h1>Incidents</h1>

                <p>
                  Investigate failures. Replay recorded requests.
                  Find the divergence.
                </p>
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={openCreateForm}
                aria-expanded={showCreateForm}
              >
                <span aria-hidden="true">+</span>
                New Incident
              </button>
            </section>

            {createSuccess && (
              <div
                className="create-success"
                role="status"
                aria-live="polite"
              >
                <strong>Incident created</strong>
                <p>{createSuccess}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setCreateSuccess("")}
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Create incident form */}
            {showCreateForm && (
              <section
                className="create-panel"
                aria-labelledby="create-heading"
              >
                <div className="create-panel-heading">
                  <div>
                    <div className="section-index">
                      NEW RECORD / INCIDENT
                    </div>
                    <h2 id="create-heading">Create Incident</h2>
                    <p>
                      Record an incident before adding its HTTP
                      request sequence.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateError("");
                    }}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                </div>

                <form
                  onSubmit={handleCreateIncident}
                  className="create-form"
                >
                  <div className="form-field">
                    <label htmlFor="incident-title">
                      Title <span>*</span>
                    </label>
                    <input
                      id="incident-title"
                      name="title"
                      type="text"
                      value={newTitle}
                      onChange={(event) =>
                        setNewTitle(event.target.value)
                      }
                      placeholder="e.g. Payment API returning 500 errors"
                      maxLength={200}
                      required
                      autoFocus
                      disabled={creating}
                    />
                    <div className="field-hint">
                      {newTitle.length}/200 characters
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="incident-description">
                      Description
                    </label>
                    <textarea
                      id="incident-description"
                      name="description"
                      value={newDescription}
                      onChange={(event) =>
                        setNewDescription(event.target.value)
                      }
                      placeholder="What failed, what was expected, and what you observed..."
                      rows={3}
                      disabled={creating}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="incident-severity">
                      Severity
                    </label>
                    <select
                      id="incident-severity"
                      name="severity"
                      value={newSeverity}
                      onChange={(event) =>
                        setNewSeverity(event.target.value as Severity)
                      }
                      disabled={creating}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  {createError && (
                    <div
                      className="create-error"
                      role="alert"
                      aria-live="assertive"
                    >
                      <strong>Incident not created</strong>
                      <p>{createError}</p>
                    </div>
                  )}

                  <div className="create-form-actions">
                    <span className="required-note">
                      * Required field
                    </span>

                    <button
                      type="submit"
                      className="primary-button"
                      disabled={creating || !newTitle.trim()}
                    >
                      {creating
                        ? "Creating incident..."
                        : "Create incident"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Summary statistics */}
            <section
              className="summary-strip"
              aria-label="Incident summary"
            >
              <div className="summary-item">
                <span className="summary-label">
                  TOTAL INCIDENTS
                </span>
                <div className="summary-value">
                  {loading
                    ? "—"
                    : String(stats.total).padStart(2, "0")}
                </div>
                <span className="summary-note">
                  Recorded in workspace
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">OPEN</span>
                <div className="summary-value amber-value">
                  {loading
                    ? "—"
                    : String(stats.open).padStart(2, "0")}
                </div>
                <span className="summary-note">
                  Require investigation
                </span>
              </div>

              <div className="summary-item">
                <span className="summary-label">RESOLVED</span>
                <div className="summary-value green-value">
                  {loading
                    ? "—"
                    : String(stats.resolved).padStart(2, "0")}
                </div>
                <span className="summary-note">
                  Closed incidents
                </span>
              </div>
            </section>

            {/* Incidents table */}
            <section className="incident-section">
              <div className="section-heading">
                <div>
                  <div className="section-index">01 / QUEUE</div>
                  <h2>Incident records</h2>
                </div>

                <span className="data-source">
                  <span className="source-dot" />
                  BACKEND DATA
                </span>
              </div>

              <div className="table-controls">
                <label className="search-control">
                  <span
                    aria-hidden="true"
                    className="search-symbol"
                  >
                    ⌕
                  </span>
                  <input
                    type="search"
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search incidents, IDs, descriptions..."
                    aria-label="Search incidents"
                  />
                  {search && (
                    <button
                      type="button"
                      className="clear-search"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </label>

                <label className="filter-control">
                  <span>STATUS</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target.value as StatusFilter
                      )
                    }
                    aria-label="Filter incidents by status"
                  >
                    <option value="all">All incidents</option>
                    <option value="open">Open</option>
                    <option value="resolved">
                      Resolved / closed
                    </option>
                  </select>
                </label>
              </div>

              {error ? (
                <div
                  className="state-panel error-panel"
                  role="alert"
                >
                  <span className="state-code">ERR / API</span>
                  <h3>Incident records unavailable</h3>
                  <p>{error}</p>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void loadIncidents()}
                    disabled={loading}
                  >
                    Retry request
                  </button>
                </div>
              ) : loading ? (
                <div className="state-panel" role="status">
                  <span className="state-code">
                    GET /api/incidents
                  </span>
                  <h3>Loading incident records</h3>
                  <p>Waiting for the backend response.</p>
                </div>
              ) : filteredIncidents.length === 0 ? (
                <div className="state-panel">
                  <span className="state-code">NO MATCHES</span>
                  <h3>
                    {incidents.length === 0
                      ? "No incidents recorded"
                      : "No matching incidents"}
                  </h3>
                  <p>
                    {incidents.length === 0
                      ? "Create an incident to begin recording and replaying requests."
                      : "Change the search or status filter to find another incident."}
                  </p>

                  {incidents.length === 0 ? (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={openCreateForm}
                    >
                      + Create your first incident
                    </button>
                  ) : (
                    (search || statusFilter !== "all") && (
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => {
                          setSearch("");
                          setStatusFilter("all");
                        }}
                      >
                        Clear filters
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="incident-table">
                    <thead>
                      <tr>
                        <th scope="col">INCIDENT</th>
                        <th scope="col">SEVERITY</th>
                        <th scope="col">STATUS</th>
                        <th scope="col">LAST REPLAY</th>
                        <th scope="col">CREATED</th>
                        <th scope="col">
                          <span className="visually-hidden">
                            Actions
                          </span>
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredIncidents.map((incident) => (
                        <tr key={incident.id}>
                          <td className="incident-title-cell">
                            <div className="incident-id">
                              INC-
                              {String(incident.id).padStart(3, "0")}
                            </div>
                            <div className="incident-title">
                              {incident.title}
                            </div>
                            {incident.description && (
                              <div className="incident-description">
                                {incident.description}
                              </div>
                            )}
                          </td>

                          <td>
                            <span
                              className={`severity-indicator severity-${severityClass(
                                incident.severity
                              )}`}
                            >
                              <span className="severity-dot" />
                              {incident.severity || "Unknown"}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`status-badge status-${statusClass(
                                incident.status
                              )}`}
                            >
                              {incident.status || "Unknown"}
                            </span>
                          </td>

                          <td className="replay-placeholder">
                            <span aria-label="Replay history unavailable">
                              —
                            </span>
                            <span className="muted-detail">
                              No replay data
                            </span>
                          </td>

                          <td className="date-cell">
                            {formatDate(
                              incident.created_at ??
                                incident.createdAt
                            )}
                          </td>

                          <td className="action-cell">
                            <button
                              type="button"
                              className="row-action"
                              onClick={() =>
                                void openIncidentDetails(incident)
                              }
                              aria-label={`View details for ${incident.title}`}
                              title="View incident details"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!loading &&
                !error &&
                filteredIncidents.length > 0 && (
                  <footer className="table-footer">
                    <span>
                      SHOWING{" "}
                      <strong>{filteredIncidents.length}</strong>{" "}
                      OF <strong>{incidents.length}</strong>{" "}
                      INCIDENTS
                    </span>
                    <span className="footer-mono">
                      SOURCE: POSTGRESQL API
                    </span>
                  </footer>
                )}
            </section>
          </>
        )}

        <footer className="app-footer">
          <span>
            RETRACE{" "}
            <span className="footer-divider">/</span>{" "}
            INCIDENT REPLAY WORKBENCH
          </span>
          <span>DIAGNOSTICS FIRST.</span>
        </footer>
      </main>
    </div>
  );
}

export default App;

