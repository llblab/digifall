import { yamux } from "@chainsafe/libp2p-yamux";
import {
  DEFAULT_RECORD_TYPES,
  DEFAULT_RELAYS as HARDCODED_RELAYS,
  LeaderboardCore,
  PROTOCOLS,
  parseMessage,
} from "@digifall/leaderboard";
import { bootstrap } from "@libp2p/bootstrap";
import { circuitRelayTransport } from "@libp2p/circuit-relay-v2";
import { loadOrCreateSelfKey } from "@libp2p/config";
import { floodsub } from "@libp2p/floodsub";
import { identify } from "@libp2p/identify";
import { keychain } from "@libp2p/keychain";
import { plaintext } from "@libp2p/plaintext";
import { pubsubPeerDiscovery } from "@libp2p/pubsub-peer-discovery";
import { webSockets } from "@libp2p/websockets";
import { multiaddr } from "@multiformats/multiaddr";
import { FsDatastore } from "datastore-fs";
import { createLibp2p } from "libp2p";
import fs from "node:fs/promises";
import path from "node:path";

const DEBUG = process.env.DEBUG === "true";
const MAX_RECORDS = 1000;
const PERSISTENCE_PATH = "./nodes/leaderboard/data.json";

function parseRelaysFromEnv() {
  const envValue = process.env.DIGIFALL_RELAYS || process.env.DIGIFALL_RELAY;
  if (!envValue) return null;
  return envValue
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
}

const RELAYS = parseRelaysFromEnv() || HARDCODED_RELAYS;

const relayPeerIds = RELAYS.map((addr) => {
  const match = addr.match(/\/p2p\/([a-zA-Z0-9]+)$/);
  return match ? match[1] : null;
}).filter(Boolean);

async function loadPersistedData() {
  try {
    const data = await fs.readFile(PERSISTENCE_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function savePersistedData(data) {
  const dir = path.dirname(PERSISTENCE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(PERSISTENCE_PATH, JSON.stringify(data, null, 2));
}

let lastPeerCount = 0;
let lastRecordCount = 0;

function formatTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function logStatus() {
  const peerCount = libp2p
    ? new Set(libp2p.getConnections().map((c) => c.remotePeer.toString())).size
    : 0;
  const recordCount = DEFAULT_RECORD_TYPES.reduce(
    (sum, type) => sum + core.getData(type).length,
    0,
  );
  if (peerCount !== lastPeerCount || recordCount !== lastRecordCount) {
    console.log(
      `${formatTimestamp()} | ${peerCount} peers, ${recordCount} records`,
    );
    lastPeerCount = peerCount;
    lastRecordCount = recordCount;
  }
}

const core = new LeaderboardCore({
  recordTypes: DEFAULT_RECORD_TYPES,
  maxRecords: MAX_RECORDS,
  debug: DEBUG,
  onUpdate: async (_type, _records) => {
    await savePersistedData(core.getAllData());
    logStatus();
  },
});

const persistedData = await loadPersistedData();
if (persistedData) {
  for (const type of DEFAULT_RECORD_TYPES) {
    if (persistedData[type]) {
      core.loadData(type, persistedData[type]);
    }
  }
  const totalRecords = DEFAULT_RECORD_TYPES.reduce(
    (sum, type) => sum + core.getData(type).length,
    0,
  );
  console.log(`Loaded ${totalRecords} records from persistence`);
}

async function handleRecordMessage(message) {
  try {
    const record = parseMessage(message);
    if (record) core.handleRecord(record);
  } catch (e) {
    if (DEBUG) console.error(e);
  }
}

const pushPreview = core.createPushPreview(handleRecordMessage);
const pushRoot = core.createPushRoot(handleRecordMessage);
const handleRoot = core.createRootHandler(pushPreview);
const handlePreview = core.createPreviewHandler();

async function handleConnectionOpen({ detail: connection }) {
  const remotePeerId = connection.remotePeer.toString();
  if (DEBUG) console.log("connection:open", remotePeerId);
  logStatus();
  if (relayPeerIds.includes(remotePeerId)) return;
  if (connection.status !== "open") return;
  const result = await pushRoot(connection);
  if (result?.error?.name === "UnsupportedProtocolError") {
    connection.close();
  }
}

function handleConnectionChange() {
  logStatus();
}

let libp2p;

async function handlePubsubMessage({ detail: { from: peerId } }) {
  if (DEBUG) {
    console.log(
      "pubsub:message",
      peerId.toString(),
      peerId.toString() === libp2p.peerId.toString() ? "local" : "remote",
    );
  }
  if (libp2p.getConnections(peerId).length === 0) {
    libp2p.dial(peerId).catch(() => {});
  }
}

let currentRelayIndex = -1;

async function restoreRelay() {
  if (libp2p?.status !== "started") return;
  if (libp2p.getConnections().length > 0) return;
  if (DEBUG) console.log("restoreRelay");
  currentRelayIndex = (currentRelayIndex + 1) % RELAYS.length;
  return libp2p.dial(multiaddr(RELAYS[currentRelayIndex])).catch((e) => {
    console.error("Failed to restore relay", e.message);
  });
}

const store = new FsDatastore("./nodes/leaderboard/peerstore");
const privateKey = await loadOrCreateSelfKey(store);

libp2p = await createLibp2p({
  privateKey,
  addresses: {
    listen: ["/p2p-circuit"],
  },
  transports: [webSockets(), circuitRelayTransport()],
  connectionEncrypters: [plaintext()],
  streamMuxers: [yamux()],
  peerDiscovery: [
    bootstrap({ list: RELAYS }),
    pubsubPeerDiscovery({
      interval: 13e3,
      topics: ["digifall._peer-discovery"],
      listenOnly: false,
    }),
  ],
  connectionGater: {
    denyDialMultiaddr: () => false,
    denyDialPeer() {
      return libp2p.getConnections().length >= 10;
    },
    denyInboundConnection() {
      return libp2p.getConnections().length >= 20;
    },
  },
  services: {
    identify: identify({ protocolPrefix: "digifall" }),
    pubsub: floodsub({ emitSelf: true }),
    keychain: keychain(),
  },
});

libp2p.services.pubsub.addEventListener("message", handlePubsubMessage);
libp2p.addEventListener("connection:open", handleConnectionOpen);
libp2p.addEventListener("connection:close", handleConnectionChange);
libp2p.handle(PROTOCOLS.root, handleRoot, { runOnLimitedConnection: true });
libp2p.handle(PROTOCOLS.preview, handlePreview, {
  runOnLimitedConnection: true,
});

console.log(
  `Headless leaderboard node starting with id: ${libp2p.peerId.toString()}`,
);
console.log(`Using relays: ${RELAYS.join(", ")}`);

await libp2p.start();

setInterval(() => restoreRelay().catch(() => {}), 73e3);
