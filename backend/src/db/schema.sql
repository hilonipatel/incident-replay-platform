CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    severity VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'investigating', 'resolved')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_events (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    sequence_number INTEGER NOT NULL CHECK (sequence_number > 0),
    method VARCHAR(10) NOT NULL
        CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
    path VARCHAR(500) NOT NULL,
    headers JSONB NOT NULL DEFAULT '{}'::jsonb,
    request_body JSONB,
    expected_status INTEGER NOT NULL
        CHECK (expected_status BETWEEN 100 AND 599),
    expected_response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (incident_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS replay_runs (
    id BIGSERIAL PRIMARY KEY,
    incident_id BIGINT NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE TABLE IF NOT EXISTS replay_results (
    id BIGSERIAL PRIMARY KEY,
    replay_run_id BIGINT NOT NULL REFERENCES replay_runs(id) ON DELETE CASCADE,
    incident_event_id BIGINT NOT NULL REFERENCES incident_events(id) ON DELETE CASCADE,
    actual_status INTEGER,
    actual_response_body JSONB,
    duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
    result VARCHAR(10) NOT NULL CHECK (result IN ('PASS', 'FAIL')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (replay_run_id, incident_event_id)
);

CREATE INDEX IF NOT EXISTS idx_incidents_status
    ON incidents(status);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident_sequence
    ON incident_events(incident_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_replay_runs_incident
    ON replay_runs(incident_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_replay_results_run
    ON replay_results(replay_run_id);