export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonOk(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function jsonError(error: HttpError): Response {
  return Response.json(
    {
      error: {
        message: error.message,
        status: error.status,
      },
    },
    { status: error.status },
  );
}

export async function readJson<T = unknown>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
