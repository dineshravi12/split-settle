import { Injectable, NgZone, inject } from "@angular/core";
import { Observable } from "rxjs";
import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import { environment } from "../../../environments/environment";
import { Activity } from "../models/activity.model";
import { AuthService } from "./auth.service";

export type LiveStatus = "connecting" | "live" | "reconnecting";

export type GroupLiveEvent =
  | { kind: "status"; status: LiveStatus }
  | { kind: "activity"; activity: Activity }
  // Reconnected after a drop: changes may have been missed
  | { kind: "resync" };

@Injectable({
  providedIn: "root",
})
export class RealtimeService {
  private auth = inject(AuthService);
  private zone = inject(NgZone);

  /** Live changes for one group; the connection opens on subscribe and closes on unsubscribe. */
  watchGroup(groupId: number): Observable<GroupLiveEvent> {
    return new Observable<GroupLiveEvent>((observer) => {
      const emit = (event: GroupLiveEvent) => this.zone.run(() => observer.next(event));
      let wasLive = false;

      const client = new Client({
        brokerURL: webSocketUrl(),
        reconnectDelay: 2000,
        maxReconnectDelay: 30_000,
        reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
        heartbeatIncoming: 10_000,
        heartbeatOutgoing: 10_000,
        beforeConnect: (c) => {
          c.connectHeaders = { Authorization: `Bearer ${this.auth.getToken()}` };
        },
        onConnect: () => {
          client.subscribe(`/topic/groups/${groupId}`, (message) =>
            emit({ kind: "activity", activity: JSON.parse(message.body) as Activity }),
          );
          emit({ kind: "status", status: "live" });
          if (wasLive) {
            emit({ kind: "resync" });
          }
          wasLive = true;
        },
        onWebSocketClose: () => emit({ kind: "status", status: wasLive ? "reconnecting" : "connecting" }),
      });

      emit({ kind: "status", status: "connecting" });
      // Outside Angular so heartbeats and reconnect timers don't trigger change detection
      this.zone.runOutsideAngular(() => client.activate());
      return () => void client.deactivate();
    });
  }
}

function webSocketUrl(): string {
  const url = new URL(environment.apiUrl, window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/api\/?$/, "")}/ws`;
  return url.toString();
}
