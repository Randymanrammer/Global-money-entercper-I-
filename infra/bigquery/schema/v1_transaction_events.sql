CREATE TABLE IF NOT EXISTS `${PROJECT_ID}.core_transactions.transaction_events`
(
  event_id STRING NOT NULL,
  tenant_id STRING NOT NULL,
  account_id STRING,
  event_type STRING NOT NULL,
  amount NUMERIC,
  currency STRING,
  region STRING,
  source_system STRING,
  trace_id STRING,
  event_timestamp TIMESTAMP NOT NULL,
  ingestion_timestamp TIMESTAMP NOT NULL,
  schema_version STRING NOT NULL
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY tenant_id, event_type, region
OPTIONS (
  require_partition_filter = TRUE
);
