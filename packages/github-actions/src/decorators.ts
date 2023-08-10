import { issueCommand } from "@actions/core/lib/command";
import { issueFileCommand } from "@actions/core/lib/file-command";
import { getMetadata, defineMetadata, Target } from "./metadata";
import { EOL } from "os";
import { v4 as uuidv4 } from "uuid";

type InputFunction<Value> = (
  decoder?: DecoderFunction<Value>,
) => Value | undefined;
export type DecoderFunction<Value> = (value?: string) => Value | undefined;

export function StringDecoder(value?: string): string | undefined {
  return value;
}

export function JSONDecoder<Value>(value?: string): Value | undefined {
  return value === undefined ? undefined : (JSON.parse(value) as Value);
}

export function MultilineDecoder(value?: string): string[] | undefined {
  return value === undefined ? undefined : value.split(/\r?\n/);
}

const trueValue = ["true", "True", "TRUE"];
const falseValue = ["false", "False", "FALSE"];

export function BooleanDecoder(value?: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (trueValue.includes(value)) return true;
  if (falseValue.includes(value)) return false;
  throw new Error(
    `cannot decode boolean value: ${value} is neither true (${trueValue.join(
      ", ",
    )}) nor false (${falseValue.join(", ")})`,
  );
}

class InputPropertyWrapper<Value> {
  public static readonly SYMBOL = Symbol("InputPropertyWrapper");

  public static get<This extends Target, Value>(
    object: This,
    context: ClassFieldDecoratorContext<Target, Value>,
  ): InputPropertyWrapper<Value> {
    let wrapper = getMetadata<InputPropertyWrapper<Value>>(
      InputPropertyWrapper.SYMBOL,
      object,
      context.name,
    );
    if (wrapper === undefined) {
      wrapper = new InputPropertyWrapper<Value>(object, context);
      defineMetadata<InputPropertyWrapper<Value>>(
        InputPropertyWrapper.SYMBOL,
        wrapper,
        object,
        context.name,
      );
    }
    return wrapper;
  }

  public required: boolean = false;
  public inputs: InputFunction<Value>[] = [];
  public decoder?: DecoderFunction<Value>;

  private _value?: Value;

  private constructor(
    object: Target,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(object, context.name);

    const get = (): Value | undefined => {
      const result: Value | undefined =
        this.inputs.find((func) => func(this.decoder) !== undefined)?.(
          this.decoder,
        ) ??
        (descriptor?.get?.() as Value | undefined) ??
        this._value;
      if (
        this.required &&
        (result === undefined ||
          result === null ||
          (typeof result === "string" && result === ""))
      ) {
        throw new Error(`${context.name.toString()} is required`);
      }

      return result;
    };

    const set = (v: Value | undefined) => {
      if (descriptor?.set !== undefined) {
        descriptor.set(v);
      } else {
        this._value = v;
      }
    };

    if (descriptor === undefined) {
      Object.defineProperty(object, context.name, {
        configurable: true,
        enumerable: true,
        get,
        set,
      });
    } else {
      Object.defineProperty(object, context.name, { ...descriptor, get });
    }
  }
}

type OutputFunction<Value> = (
  value?: Value,
  secret?: boolean,
  encoder?: EncoderFunction<Value>,
) => void;
export type EncoderFunction<Value> = (value?: Value) => string | undefined;

export function StringEncoder(value?: string): string | undefined {
  return value;
}

export function JSONEncoder<Value>(value?: Value): string | undefined {
  return value === undefined ? undefined : JSON.stringify(value);
}

export function MultilineEncoder(value?: string[]): string | undefined {
  return value === undefined ? undefined : value.join(EOL);
}

export function BooleanEncoder(value?: boolean): string | undefined {
  return value === undefined ? undefined : value ? "true" : "false";
}

class OutputPropertyWrapper<Value> {
  public static readonly SYMBOL = Symbol("OutputPropertyWrapper");

  public static get<This extends Target, Value>(
    object: This,
    context: ClassFieldDecoratorContext<This, Value>,
  ): OutputPropertyWrapper<Value> {
    let wrapper = getMetadata<OutputPropertyWrapper<Value>>(
      OutputPropertyWrapper.SYMBOL,
      object,
      context.name,
    );
    if (wrapper === undefined) {
      wrapper = new OutputPropertyWrapper<Value>(object, context);
      defineMetadata<OutputPropertyWrapper<Value>>(
        OutputPropertyWrapper.SYMBOL,
        wrapper,
        object,
        context.name,
      );
    }
    return wrapper;
  }

  public secret: boolean = false;
  public outputs: OutputFunction<Value>[] = [];
  public encoder?: EncoderFunction<Value>;

  private _dirty: boolean = false;
  private _value?: Value;

  private constructor(
    object: Target,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(object, context.name);

    const get = (): Value | undefined => {
      return this._value;
    };

    const set = (v: Value | undefined) => {
      this.outputs.forEach((fn) => fn(v, this.secret, this.encoder));
      if (descriptor?.set !== undefined) {
        descriptor.set(v);
      } else {
        this._value = v;
      }
    };

    if (descriptor === undefined) {
      Object.defineProperty(object, context.name, {
        configurable: true,
        enumerable: true,
        get,
        set,
      });
    } else {
      Object.defineProperty(object, context.name, { ...descriptor, set });
    }
  }
}

export function decoder<Value>(
  fn: DecoderFunction<Value>,
): (
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
) => void {
  return (
    target: undefined,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) => {
    context.addInitializer(function (this: Target) {
      InputPropertyWrapper.get<Target, Value>(this, context).decoder = fn;
    });
  };
}

export function required<Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
) {
  context.addInitializer(function (this: Target) {
    InputPropertyWrapper.get<Target, Value>(this, context).required = true;
  });
}

export enum InputSource {
  Input,
  Environment,
}

export function input<Value>(
  name?: string,
  source: InputSource = InputSource.Input,
  decoder?: DecoderFunction<Value>,
): (
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
) => void {
  return (
    target: undefined,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) => {
    const input = name !== undefined ? name : context.name.toString();

    context.addInitializer(function (this: Target) {
      InputPropertyWrapper.get<Target, Value>(this, context).inputs.push(
        function (gd?: DecoderFunction<Value>): Value | undefined {
          const df = decoder ?? gd;
          if (df === undefined) {
            throw new Error(
              `Missing decoder for input: ${input} on property: ${context.name.toString()}`,
            );
          }

          const data =
            process.env[
              source === InputSource.Input
                ? `INPUT_${input.replace(/ /g, "_").toUpperCase()}`
                : input
            ];

          return df(data != "" ? data : undefined);
        },
      );
    });
  };
}

export enum OutputDestination {
  Output,
  Environment,
}

function prepareKeyValueMessage(
  key: string,
  value: string,
  delimiter: string = `ghadelimiter_${uuidv4()}`,
) {
  if (key.includes(delimiter)) {
    throw new Error(
      `Unexpected input: key should not contain the delimiter "${delimiter}"`,
    );
  }

  if (value.includes(delimiter)) {
    throw new Error(
      `Unexpected input: value should not contain the delimiter "${delimiter}"`,
    );
  }

  return `${key}<<${delimiter}${EOL}${value}${EOL}${delimiter}`;
}

export function output<Value>(
  name?: string,
  destination: OutputDestination = OutputDestination.Output,
  encoder?: EncoderFunction<Value>,
): (
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
) => void {
  return (
    target: undefined,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) => {
    const output = name !== undefined ? name : context.name.toString();

    context.addInitializer(function (this: Target) {
      OutputPropertyWrapper.get<Target, Value>(this, context).outputs.push(
        function (
          value?: Value,
          secret: boolean = false,
          ge?: EncoderFunction<Value>,
        ): void {
          const ef = encoder ?? ge;
          if (ef === undefined) {
            throw new Error(
              `Missing encoder for output: ${output} from property: ${context.name.toString()}`,
            );
          }
          const v = ef(value);
          if (v !== undefined) {
            switch (destination) {
              case OutputDestination.Output:
                if (process.env["GITHUB_OUTPUT"] !== undefined) {
                  return issueFileCommand(
                    "OUTPUT",
                    prepareKeyValueMessage(output, v),
                  );
                }
                process.stdout.write(EOL);
                issueCommand("set-output", { name: output }, v);
                break;
              case OutputDestination.Environment:
                process.env[output] = v;
                if (process.env["GITHUB_ENV"] !== undefined) {
                  return issueFileCommand(
                    "ENV",
                    prepareKeyValueMessage(output, v),
                  );
                }
                issueCommand("set-env", { name: output }, v);
                break;
            }
            if (secret) {
              issueCommand("add-mask", {}, value);
            }
          }
        },
      );
    });
  };
}

export function secret<Value>(
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
): void {
  context.addInitializer(function (this: Target) {
    OutputPropertyWrapper.get<Target, Value>(this, context).secret = true;
  });
}

export function encoder<Value>(
  fn: EncoderFunction<Value>,
): (
  target: undefined,
  context: ClassFieldDecoratorContext<Target, Value>,
) => void {
  return (
    target: undefined,
    context: ClassFieldDecoratorContext<Target, Value>,
  ) => {
    context.addInitializer(function (this: Target) {
      OutputPropertyWrapper.get<Target, Value>(this, context).encoder = fn;
    });
  };
}
