import { Action } from "./action";

const action = new Action();
action.run().catch((reason) => {
  process.exitCode = 1;
  Action.logger.error(
    typeof reason === "string" || reason instanceof Error
      ? reason
      : String(reason),
  );
});
