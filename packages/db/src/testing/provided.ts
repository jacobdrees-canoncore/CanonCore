/**
 * What `global-setup.ts` hands to the suite. Its own module because a
 * `declare module` augmentation only applies to programs that include the file
 * it lives in -- and `packages/api` typechecks these helpers without ever
 * compiling the global setup.
 */
declare module "vitest" {
  interface ProvidedContext {
    /** The database this run built from empty, migrated to head. */
    databaseUrl: string;
  }
}

export {};
