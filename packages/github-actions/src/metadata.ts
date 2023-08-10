// eslint-disable-next-line @typescript-eslint/ban-types
export type Target = object | Function;
export type MetadataKey = string | symbol;

export type MetadataMap<Value> = Map<MetadataKey, Value>;
export type PropertyMap<Value> = Map<
  PropertyKey | undefined,
  MetadataMap<Value>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Metadata = new WeakMap<Target, PropertyMap<any>>();

function getMetadataMap<Value>(
  target: Target,
  propertyKey?: PropertyKey,
): MetadataMap<Value> | undefined {
  return Metadata.get(target)?.get(propertyKey);
}

function createMetadataMap<Value>(
  target: Target,
  propertyKey?: PropertyKey,
): MetadataMap<Value> {
  let propertyMap = Metadata.get(target);
  if (propertyMap === undefined) {
    propertyMap = new Map<PropertyKey | undefined, MetadataMap<Value>>();
    Metadata.set(target, propertyMap);
  }
  let metadataMap = propertyMap.get(propertyKey);
  if (metadataMap === undefined) {
    metadataMap = new Map<MetadataKey, Value>();
    propertyMap.set(propertyKey, metadataMap);
  }
  return metadataMap as MetadataMap<Value>;
}

export function metadata<Value>(
  key: MetadataKey,
  value: Value,
): (target: unknown, context: DecoratorContext) => void {
  return (target: unknown, context: DecoratorContext) => {
    context.addInitializer(function (this: unknown) {
      if (
        (typeof this === "object" && this !== null) ||
        this instanceof Function
      ) {
        switch (context.kind) {
          case "class":
            defineMetadata(key, value, this);
            break;
          default:
            defineMetadata(key, value, this, context.name);
            break;
        }
      } else {
        throw new Error(
          `cannot assign metadata to instance of context: { kind: ${
            context.kind
          }, name: ${context.name?.toString()} }`,
        );
      }
    });
  };
}

export function defineMetadata<Value>(
  key: MetadataKey,
  value: Value,
  target: Target,
  propertyKey?: PropertyKey,
) {
  createMetadataMap<Value>(target, propertyKey).set(key, value);
}

export function hasOwnMetadata(
  key: MetadataKey,
  target: Target,
  propertyKey?: PropertyKey,
) {
  return getOwnMetadata(key, target, propertyKey) !== undefined;
}

export function getOwnMetadata<Value>(
  key: MetadataKey,
  target: Target,
  propertyKey?: PropertyKey,
): Value | undefined {
  return getMetadataMap<Value>(target, propertyKey)?.get(key);
}

export function hasMetadata(
  key: MetadataKey,
  target: Target,
  propertyKey?: PropertyKey,
) {
  return getMetadata(key, target, propertyKey) !== undefined;
}

export function getMetadata<Value>(
  key: MetadataKey,
  target: Target,
  propertyKey?: PropertyKey,
): Value | undefined {
  let owner: Target | undefined = target;
  while (owner !== undefined) {
    const result = getOwnMetadata<Value>(key, owner, propertyKey);
    if (result !== undefined) {
      return result;
    }
    if ("prototype" in owner) {
      owner = owner.prototype as Target;
    } else {
      owner = undefined;
    }
  }
  return undefined;
}
