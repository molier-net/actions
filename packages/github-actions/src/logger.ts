import { issueCommand } from "@actions/core/lib/command";
import { Logger } from "ts-log";
import * as os from "os";

export class ActionLogger implements Logger {
  [x: string]: unknown;
  trace(message?: unknown): void {
    issueCommand("trace", {}, message);
  }
  debug(message?: unknown): void {
    issueCommand("debug", {}, message);
  }
  info(message?: unknown): void {
    process.stdout.write(String(message) + os.EOL);
  }
  warn(message?: unknown): void {
    issueCommand("warning", {}, message);
  }
  error(message?: unknown): void {
    issueCommand("error", {}, message);
  }
}

export const logger: Logger = new ActionLogger();
