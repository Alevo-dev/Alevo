/** Thrown when there is no valid session / active org. Maps to HTTP 401. */
export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Thrown when the session is valid but lacks the required role. Maps to 403. */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}
