CREATE TABLE IF NOT EXISTS contas (
  numero CHAR(6) PRIMARY KEY CHECK (numero ~ '^[0-9]{6}$'),
  saldo NUMERIC(18, 2) NOT NULL
);
