import { yamux } from "@chainsafe/libp2p-yamux";
import { circuitRelayServer } from "@libp2p/circuit-relay-v2";
import { loadOrCreateSelfKey } from "@libp2p/config";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { keychain } from "@libp2p/keychain";
import { plaintext } from "@libp2p/plaintext";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webSockets } from "@libp2p/websockets";
import { FsDatastore } from "datastore-fs";
import { createLibp2p } from "libp2p";

const store = new FsDatastore("./nodes/relay/peerstore");
const privateKey = await loadOrCreateSelfKey(store);
const relay = await createLibp2p({
  privateKey,
  addresses: {
    listen: ["/ip4/0.0.0.0/tcp/43210/ws"],
    // announce: ["/dns4/relay.digifall.app/tcp/443/wss"],
  },
  transports: [webSockets()],
  connectionEncrypters: [plaintext()],
  streamMuxers: [yamux()],
  peerDiscovery: [
    pubsubPeerDiscovery({
      interval: 7e3,
      topics: ["digifall._peer-discovery"],
      listenOnly: true,
    }),
  ],
  services: {
    identify: identify({ protocolPrefix: "digifall" }),
    relay: circuitRelayServer({
      reservations: {
        defaultDurationLimit: 37e3,
        maxInboundHopStreams: 37,
        maxOutboundHopStreams: 37,
        maxReservations: Infinity,
      },
    }),
    pubsub: floodsub(),
    keychain: keychain(),
  },
});

console.warn(`libp2p relay starting with id: ${relay.peerId.toString()}`);

await relay.start();

console.log("\nListening on:");
relay.getMultiaddrs().forEach((ma) => console.log(ma.toString()));
