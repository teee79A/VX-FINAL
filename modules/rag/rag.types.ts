export type RagInput =
  | { op: "search"; query: string }
  | { op: "ask"; query: string };

export interface RagOutput {
  query: string;
  answers: string[];
}
