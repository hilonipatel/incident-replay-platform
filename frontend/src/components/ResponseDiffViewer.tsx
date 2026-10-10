import { useMemo, useState } from "react";
import "./ResponseDiffViewer.css";

type DiffType = "changed" | "added" | "removed";

interface DiffEntry {
  path: string;
  type: DiffType;
  expected: unknown;
  actual: unknown;
}

interface ResponseDiffViewerProps {
  expected: unknown;
  actual: unknown;
  expectedStatus: number;
  actualStatus: number | null;
  result: "PASS" | "FAIL";
  errorMessage?: string | null;
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";

  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

function collectDiffs(
  expected: unknown,
  actual: unknown,
  path = "$"
): DiffEntry[] {
  if (Object.is(expected, actual)) {
    return [];
  }

  if (isObject(expected) && isObject(actual)) {
    const diffs: DiffEntry[] = [];
    const keys = new Set([
      ...Object.keys(expected),
      ...Object.keys(actual),
    ]);

    for (const key of keys) {
      const childPath = `${path}.${key}`;
      const hasExpected = Object.hasOwn(expected, key);
      const hasActual = Object.hasOwn(actual, key);

      if (!hasExpected) {
        diffs.push({
          path: childPath,
          type: "added",
          expected: undefined,
          actual: actual[key],
        });
      } else if (!hasActual) {
        diffs.push({
          path: childPath,
          type: "removed",
          expected: expected[key],
          actual: undefined,
        });
      } else {
        diffs.push(
          ...collectDiffs(
            expected[key],
            actual[key],
            childPath
          )
        );
      }
    }

    return diffs;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: DiffEntry[] = [];
    const length = Math.max(expected.length, actual.length);

    for (let index = 0; index < length; index++) {
      const childPath = `${path}[${index}]`;
      const hasExpected = index < expected.length;
      const hasActual = index < actual.length;

      if (!hasExpected) {
        diffs.push({
          path: childPath,
          type: "added",
          expected: undefined,
          actual: actual[index],
        });
      } else if (!hasActual) {
        diffs.push({
          path: childPath,
          type: "removed",
          expected: expected[index],
          actual: undefined,
        });
      } else {
        diffs.push(
          ...collectDiffs(
            expected[index],
            actual[index],
            childPath
          )
        );
      }
    }

    return diffs;
  }

  return [
    {
      path,
      type: "changed",
      expected,
      actual,
    },
  ];
}

export default function ResponseDiffViewer({
  expected,
  actual,
  expectedStatus,
  actualStatus,
  result,
  errorMessage,
}: ResponseDiffViewerProps) {
  const [expanded, setExpanded] = useState(false);

  const statusMatches =
    actualStatus !== null &&
    actualStatus === expectedStatus;

  const hasBodies =
    expected !== undefined &&
    expected !== null &&
    actual !== undefined &&
    actual !== null;

  const diffs = useMemo(
    () =>
      hasBodies
        ? collectDiffs(expected, actual)
        : [],
    [expected, actual, hasBodies]
  );

  const bodyMatches =
    hasBodies && diffs.length === 0;

  const diagnosis = errorMessage
    ? "Request execution error"
    : actualStatus === null
      ? "No HTTP response received"
      : !statusMatches
        ? "HTTP status mismatch"
        : !hasBodies
          ? "Response body comparison unavailable"
          : bodyMatches
            ? "Response bodies match"
            : "Response body mismatch";

  const diagnosisClass =
    errorMessage || actualStatus === null
      ? "diff-error"
      : !statusMatches || (hasBodies && !bodyMatches)
        ? "diff-failure"
        : result === "PASS"
          ? "diff-success"
          : "diff-warning";

  async function copyDiff() {
    const report = diffs
      .map(
        (diff) =>
          `${diff.type.toUpperCase()} ${diff.path}\n` +
          `Expected: ${formatValue(diff.expected)}\n` +
          `Actual: ${formatValue(diff.actual)}`
      )
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(
        [
          `Diagnosis: ${diagnosis}`,
          `Expected HTTP: ${expectedStatus}`,
          `Actual HTTP: ${actualStatus ?? "No response"}`,
          "",
          report || "No JSON differences available.",
        ].join("\n")
      );
    } catch {
      // Clipboard access may be unavailable in insecure contexts.
    }
  }

  return (
    <section className="response-diff">
      <div className="response-diff-summary">
        <div className="response-diff-heading">
          <span className={`diff-result-dot ${diagnosisClass}`} />
          <strong>{diagnosis}</strong>
        </div>

        <div className="diff-status-line">
          <span>
            Expected HTTP <strong>{expectedStatus}</strong>
          </span>
          <span
            className={
              statusMatches
                ? "diff-status-match"
                : "diff-status-mismatch"
            }
          >
            Actual HTTP <strong>{actualStatus ?? "—"}</strong>
          </span>
        </div>

        {errorMessage && (
          <p className="diff-error-message">{errorMessage}</p>
        )}

        {hasBodies && (
          <div className="diff-counts">
            <span className="diff-count changed">
              {diffs.filter((d) => d.type === "changed").length} changed
            </span>
            <span className="diff-count added">
              {diffs.filter((d) => d.type === "added").length} added
            </span>
            <span className="diff-count removed">
              {diffs.filter((d) => d.type === "removed").length} removed
            </span>
          </div>
        )}
      </div>

      <div className="response-diff-actions">
        <button
          type="button"
          className="diff-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide JSON diff" : "Inspect JSON diff"}
          <span aria-hidden="true">
            {expanded ? " −" : " +"}
          </span>
        </button>

        <button
          type="button"
          className="diff-copy"
          onClick={() => void copyDiff()}
          disabled={!hasBodies || diffs.length === 0}
        >
          Copy differences
        </button>
      </div>

      {expanded && (
        <div className="response-diff-content">
          {!hasBodies ? (
            <p className="diff-empty">
              A complete expected and actual response body is not
              available for comparison.
            </p>
          ) : diffs.length === 0 ? (
            <p className="diff-empty">
              The expected and actual JSON bodies match.
            </p>
          ) : (
            <div className="diff-table-wrapper">
              <table className="diff-table">
                <thead>
                  <tr>
                    <th>JSON path</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Change</th>
                  </tr>
                </thead>

                <tbody>
                  {diffs.map((diff) => (
                    <tr
                      key={`${diff.path}-${diff.type}`}
                      className={`diff-row diff-row-${diff.type}`}
                    >
                      <td>
                        <code>{diff.path}</code>
                      </td>
                      <td>
                        <pre>
                          {formatValue(diff.expected)}
                        </pre>
                      </td>
                      <td>
                        <pre>
                          {formatValue(diff.actual)}
                        </pre>
                      </td>
                      <td>
                        <span
                          className={`diff-type diff-type-${diff.type}`}
                        >
                          {diff.type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}