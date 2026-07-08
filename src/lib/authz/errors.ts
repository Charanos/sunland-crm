import { NextResponse } from "next/server";

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super(message, 401, "unauthorized");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "You do not have permission to perform this action") {
    super(message, 403, "forbidden");
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super(message, 404, "not_found");
  }
}

export class ConflictError extends DomainError {
  constructor(message = "Conflicting state") {
    super(message, 409, "conflict");
  }
}

export class DomainValidationError extends DomainError {
  constructor(message = "Invalid request") {
    super(message, 400, "validation_error");
  }
}

export class RateLimitedError extends DomainError {
  constructor(message = "Too many requests") {
    super(message, 429, "rate_limited");
  }
}

/** Single error → HTTP mapper every route handler funnels through. */
export function handleRouteError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("Unhandled route error:", error);
  return NextResponse.json(
    { error: "Internal server error", code: "internal_error" },
    { status: 500 },
  );
}
