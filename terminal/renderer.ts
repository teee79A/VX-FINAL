import { ResultEnvelope } from "../shared/result.types.js";

export class OutputRenderer {
  render<T>(result: ResultEnvelope<T>): {
    ok: boolean;
    requestId: string;
    data?: T;
    errorCode?: string;
    errorMessage?: string;
  } {
    const out: {
      ok: boolean;
      requestId: string;
      data?: T;
      errorCode?: string;
      errorMessage?: string;
    } = {
      ok: result.ok,
      requestId: result.requestId,
    };
    if (result.data !== undefined) {
      out.data = result.data;
    }
    if (result.error) {
      out.errorCode = result.error.code;
      out.errorMessage = result.error.message;
    }
    return out;
  }
}
