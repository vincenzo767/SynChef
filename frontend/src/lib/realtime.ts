import { Client, type IMessage, type StompSubscription } from "@stomp/stompjs";
import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * One shared STOMP connection for the whole app (previously every admin page opened its own).
 * The WebSocket handshake is authenticated by the HttpOnly session cookie; the server authorizes
 * each subscription. Subscriptions are re-established automatically after reconnects.
 */
export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting";

type Handler = (body: unknown) => void;

interface Registration {
  destination: string;
  handler: Handler;
  subscription: StompSubscription | null;
}

let client: Client | null = null;
let status: ConnectionStatus = "idle";
const statusListeners = new Set<() => void>();
const registrations = new Set<Registration>();

function setStatus(next: ConnectionStatus) {
  status = next;
  statusListeners.forEach((l) => l());
}

function brokerUrl(): string {
  const { protocol, host } = window.location;
  return `${protocol === "https:" ? "wss" : "ws"}://${host}/ws`;
}

function attach(reg: Registration) {
  if (!client?.connected) return;
  reg.subscription = client.subscribe(reg.destination, (message: IMessage) => {
    try {
      reg.handler(JSON.parse(message.body));
    } catch {
      // Ignore malformed frames rather than breaking the UI.
    }
  });
}

export function connectRealtime() {
  if (client) return;
  setStatus("connecting");
  client = new Client({
    brokerURL: brokerUrl(),
    reconnectDelay: 3000,
    heartbeatIncoming: 15000,
    heartbeatOutgoing: 15000,
    onConnect: () => {
      setStatus("connected");
      registrations.forEach(attach);
    },
    onWebSocketClose: () => {
      if (client) setStatus("reconnecting");
      registrations.forEach((r) => (r.subscription = null));
    },
    onStompError: () => setStatus("reconnecting")
  });
  client.activate();
}

export function disconnectRealtime() {
  const current = client;
  client = null;
  registrations.forEach((r) => (r.subscription = null));
  setStatus("idle");
  void current?.deactivate();
}

export function subscribe(destination: string, handler: Handler): () => void {
  const reg: Registration = { destination, handler, subscription: null };
  registrations.add(reg);
  attach(reg);
  return () => {
    registrations.delete(reg);
    try {
      reg.subscription?.unsubscribe();
    } catch {
      // Connection already closed.
    }
  };
}

export function useConnectionStatus(): ConnectionStatus {
  return useSyncExternalStore(
    (listener) => {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    () => status,
    () => "idle"
  );
}

/** Subscribes while mounted; the latest handler is always used without resubscribing. */
export function useSubscription<T>(destination: string | null, handler: (body: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!destination) return undefined;
    return subscribe(destination, (body) => handlerRef.current(body as T));
  }, [destination]);
}
