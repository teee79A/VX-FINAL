export type RoomSummary = Record<string, unknown>;

export type RoomSummaryValidationResult =
  | { ok: true; errors: []; value: RoomSummary }
  | { ok: false; errors: string[] };

export declare function validateRoomSummary(value: unknown): RoomSummaryValidationResult;
