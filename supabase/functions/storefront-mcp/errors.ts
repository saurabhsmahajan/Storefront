// Structured tool errors. A tool never returns a raw exception: only one of these.
export type ErrorType =
  | "invalid_input"
  | "unauthorized"
  | "not_found"
  | "upstream_unavailable"
  | "internal";

export type ToolErrorBody = {
  error: {
    type: ErrorType;
    message: string;
    retryable: boolean;
    next_action: string;
  };
};

const CATALOG: Record<
  ErrorType,
  { message: string; retryable: boolean; next_action: string }
> = {
  invalid_input: {
    message: "The order ID is missing or is not a full order ID.",
    retryable: false,
    next_action:
      "Ask the customer for the full order ID (a UUID, 36 characters), then call the tool again.",
  },
  unauthorized: {
    message: "No signed-in customer could be identified for this request.",
    retryable: false,
    next_action: "Ask the customer to sign in again. Do not retry.",
  },
  not_found: {
    message: "No order with that ID was found on this customer's account.",
    retryable: false,
    next_action:
      "Tell the customer no such order was found on their account and ask them to check the ID.",
  },
  upstream_unavailable: {
    message: "The data store did not answer.",
    retryable: true,
    next_action:
      "Wait a few seconds and retry once. If it fails again, hand over to a human agent.",
  },
  internal: {
    message: "The tool failed for a reason that is not the customer's input.",
    retryable: false,
    next_action: "Do not retry. Hand over to a human agent.",
  },
};

export class ToolFailure extends Error {
  kind: ErrorType;
  constructor(kind: ErrorType) {
    super(kind);
    this.kind = kind;
  }
}

export function errorBody(kind: ErrorType): ToolErrorBody {
  return { error: { type: kind, ...CATALOG[kind] } };
}
