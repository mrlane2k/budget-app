import { apiPath } from "@/lib/basepath";
import { ClientRequestError } from "@/lib/client/errors";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type RequestOptions = {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  tauriCommand?: string;
  tauriArgs?: object;
};

type TauriCoreModule = Awaited<typeof import("@tauri-apps/api/core")>;
type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
  isTauri?: boolean;
};

let tauriCorePromise: Promise<TauriCoreModule | null> | undefined;

function getTauriTransportMode(): string {
  return process.env.NEXT_PUBLIC_DESKTOP_TRANSPORT ?? "auto";
}

async function loadTauriCore(): Promise<TauriCoreModule | null> {
  if (typeof window === "undefined") {
    return null;
  }

  if (!tauriCorePromise) {
    tauriCorePromise = import("@tauri-apps/api/core").catch(() => null);
  }

  return tauriCorePromise;
}

function hasTauriRuntimeGlobals(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const tauriWindow = window as TauriWindow;
  return Boolean(
    tauriWindow.__TAURI_INTERNALS__ ||
    tauriWindow.__TAURI__ ||
    tauriWindow.isTauri
  );
}

async function shouldUseTauriTransport(): Promise<boolean> {
  const mode = getTauriTransportMode();
  if (mode === "http") {
    return false;
  }

  const tauriCore = await loadTauriCore();
  const isTauriRuntime = Boolean(hasTauriRuntimeGlobals() || tauriCore?.isTauri());

  if (mode === "tauri") {
    return isTauriRuntime;
  }

  return isTauriRuntime;
}

export async function isTauriDesktopRuntime(): Promise<boolean> {
  return shouldUseTauriTransport();
}

function toClientError(error: unknown): ClientRequestError {
  if (error instanceof ClientRequestError) {
    return error;
  }

  if (typeof error === "string") {
    return new ClientRequestError(error);
  }

  if (error instanceof Error) {
    return new ClientRequestError(error.message);
  }

  if (typeof error === "object" && error !== null) {
    const message =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "Desktop request failed";
    return new ClientRequestError(message, { details: error });
  }

  return new ClientRequestError("Desktop request failed");
}

async function readResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

export async function request<T>({
  path,
  method = "GET",
  body,
  tauriCommand,
  tauriArgs,
}: RequestOptions): Promise<T> {
  if (tauriCommand && await shouldUseTauriTransport()) {
    const tauriCore = await loadTauriCore();
    if (!tauriCore) {
      throw new ClientRequestError("Tauri runtime is not available.");
    }

    try {
      return await tauriCore.invoke<T>(
        tauriCommand,
        (tauriArgs ?? {}) as Record<string, unknown>
      );
    } catch (error) {
      throw toClientError(error);
    }
  }

  const response = await fetch(apiPath(path), {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await readResponseBody(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : response.statusText || "Request failed.";

    throw new ClientRequestError(message, {
      status: response.status,
      details: payload,
    });
  }

  return payload as T;
}
