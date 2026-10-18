export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

const ts = () => new Date().toISOString();

export const consoleLogger: Logger = {
  info: (m) => console.log(`${ts()} INFO  ${m}`),
  warn: (m) => console.warn(`${ts()} WARN  ${m}`),
  error: (m, err) => console.error(`${ts()} ERROR ${m}`, err ?? ""),
};

export const silentLogger: Logger = { info() {}, warn() {}, error() {} };
