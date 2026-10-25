// Type-only check that en.json has exactly the keys of tr.json (the reference).
// Lives in a .ts file on purpose: skipLibCheck ignores errors in .d.ts files.
// Placeholder and rich-text tag parity is covered by e2e/i18n.spec.ts.
import type en from "../../messages/en.json";
import type tr from "../../messages/tr.json";

// Every message as a dotted path ("auth.register.title"). A path that is a
// string in one file and a group in the other yields different paths.
type MessagePaths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : MessagePaths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

type Missing<From, In> = Exclude<MessagePaths<From>, MessagePaths<In>>;
type ExpectNone<Paths extends never> = Paths;

// A failure names the offending path.
export type MissingInEnglish = ExpectNone<Missing<typeof tr, typeof en>>;
export type UnexpectedInEnglish = ExpectNone<Missing<typeof en, typeof tr>>;
