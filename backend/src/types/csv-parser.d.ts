declare module 'csv-parser' {
  import { Transform } from 'stream';

  interface CsvParserOptions {
    separator?: string;
    strict?: boolean;
    headers?: readonly string[] | boolean;
    skipLines?: number;
    mapHeaders?: (args: { header: string; index: number }) => string;
    mapValues?: (args: { header: string; index: number; value: string }) => unknown;
  }

  export default function csvParser(options?: CsvParserOptions): Transform;
}
