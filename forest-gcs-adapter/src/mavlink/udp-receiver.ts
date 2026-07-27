import { createSocket, type Socket } from "node:dgram";
import { PassThrough } from "node:stream";
import {
  MavLinkPacketParser,
  MavLinkPacketSplitter,
  common,
  minimal,
  type MavLinkData,
  type MavLinkDataConstructor,
  type MavLinkPacket,
  type MavLinkPacketRegistry,
} from "node-mavlink";
import { logger } from "../logger.js";
import { TelemetryStore } from "../telemetry-store.js";
import { TelemetryAggregator } from "./telemetry-aggregator.js";

const registry: MavLinkPacketRegistry = { ...minimal.REGISTRY, ...common.REGISTRY };

export class MavlinkUdpReceiver {
  #socket: Socket | null = null;
  #sources = new Map<string, PassThrough>();

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly store: TelemetryStore,
  ) {}

  start() {
    if (this.#socket) return;
    const createReader = (sourceAddress: string) => {
      const input = new PassThrough();
      const aggregator = new TelemetryAggregator();
      const reader = input
        .pipe(new MavLinkPacketSplitter())
        .pipe(new MavLinkPacketParser());

      reader.on("data", (packet: MavLinkPacket) => {
        const messageType = registry[packet.header.msgid] as MavLinkDataConstructor<MavLinkData> | undefined;
        if (!messageType) return;
        try {
          const message = packet.protocol.data(packet.payload, messageType);
          const telemetry = aggregator.accept(sourceAddress, packet.header.sysid, packet.header.compid, message);
          if (telemetry) this.store.update(telemetry);
        } catch (error) {
          logger.warn("MAVLINK", "메시지 해석 실패", {
            sourceAddress,
            msgid: packet.header.msgid,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      this.#sources.set(sourceAddress, input);
      return input;
    };

    const socket = createSocket("udp4");
    socket.on("message", (message, remote) => {
      const input = this.#sources.get(remote.address) ?? createReader(remote.address);
      input.write(message);
    });
    socket.on("error", (error) => logger.error("MAVLINK", "UDP 수신 오류", { error: error.message }));
    socket.bind(this.port, this.host, () => logger.ok("MAVLINK", `UDP ${this.host}:${this.port} 수신 대기`));
    this.#socket = socket;
  }

  stop() {
    this.#socket?.close();
    this.#socket = null;
    for (const input of this.#sources.values()) input.destroy();
    this.#sources.clear();
  }
}
