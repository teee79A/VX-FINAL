export interface TerminalError {
  code: string;
  message: string;
  retryable: boolean;
}

export class TerminalErrorCode extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
