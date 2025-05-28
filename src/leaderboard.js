import { yamux } from "@chainsafe/libp2p-yamux";
import {
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
import { IDBDatastore } from "datastore-idb";
import { createLibp2p } from "libp2p";

import {
  DEBUG,
  KEYS,
  MAX_RECORDS,
  PHASES,
  RECORD_TYPES,
  USE_ALL_RELAYS,
} from "./constants.js";
import { createIndexedDBFactory } from "./persistence.js";
import {
  activeRelaysStore,
  optionsStore,
  phaseStore,
  recordsStore,
  relayPeerIdsStore,
} from "./stores.js";
import { validateRecord } from "./validation.js";

let currentRelayIndex = -1;

/** @type {import('@libp2p/interface').Libp2p} */
let libp2p;
const blacklist = new Set();
const pendingDials = new Set();
const pushedPeers = new Set();

const createLeaderboardStore = await createIndexedDBFactory(KEYS.leaderboard);

export const leaderboardStores = Object.fromEntries(
  await Promise.all(
    RECORD_TYPES.map(async (type) => [
      type,
      await createLeaderboardStore(type, []),
    ]),
  ),
);

const core = new LeaderboardCore({
  recordTypes: RECORD_TYPES,
  maxRecords: MAX_RECORDS,
  debug: DEBUG,
  validateRecord,
  onUpdate: (type, records) => {
    leaderboardStores[type].set(records);
  },
});

async function handleRecordMessage(message) {
  try {
    const record = parseMessage(message);
    if (record) {
      const result = await core.handleRecordWithValidation(record);
    }
  } catch (error) {
    if (DEBUG) console.error("handleRecordMessage error:", error);
  }
}

const pushPreview = core.createPushPreview(handleRecordMessage);
const pushRoot = core.createPushRoot(handleRecordMessage);
const handleRoot = core.createRootHandler(pushPreview);
const handlePreview = core.createPreviewHandler();

function getCurrentRelayPeerId() {
  const relayPeerIds = relayPeerIdsStore.get();
  if (relayPeerIds.length === 0) return null;
  if (currentRelayIndex === -1 || currentRelayIndex >= relayPeerIds.length) {
    currentRelayIndex = Math.floor(Math.random() * relayPeerIds.length);
  }
  return relayPeerIds[currentRelayIndex];
}

async function handleConnectionOpen({ detail: connection }) {
  const remotePeerId = connection.remotePeer.toString();
  if (DEBUG) console.log("connection:open", remotePeerId);
  if (blacklist.has(remotePeerId)) return;
  if (connection.status !== "open") return;
  const isRelay = activeRelaysStore
    .get()
    .some((addr) => addr.includes(remotePeerId));
  if (isRelay) return;
  if (pushedPeers.has(remotePeerId)) return;
  pushedPeers.add(remotePeerId);
  const result = await pushRoot(connection);
  pushedPeers.delete(remotePeerId);
  if (result?.error?.name === "UnsupportedProtocolError") {
    connection.close();
  }
}

async function handlePubsubMessage({ detail: { from: peerId } }) {
  if (DEBUG) {
    console.log(
      "pubsub:message",
      peerId.toString(),
      peerId.equals(libp2p.peerId) ? "local" : "remote",
    );
  }
  if (peerId.equals(libp2p.peerId)) return;
  if (libp2p.getConnections(peerId).length > 0) return;
  const peerIdStr = peerId.toString();
  if (pendingDials.has(peerIdStr)) return;
  if (relayPeerIdsStore.get().includes(peerIdStr)) return;
  const relayConnection = libp2p
    .getConnections()
    .find(({ remotePeer }) =>
      relayPeerIdsStore.get().includes(remotePeer.toString()),
    );
  if (!relayConnection) return;
  const circuitAddr = multiaddr(
    `${relayConnection.remoteAddr.toString()}/p2p-circuit/p2p/${peerIdStr}`,
  );
  pendingDials.add(peerIdStr);
  libp2p
    .dial(circuitAddr)
    .catch(() => {})
    .finally(() => {
      pendingDials.delete(peerIdStr);
    });
}

async function restoreRelay() {
  if (libp2p?.status !== "started") return;
  if (libp2p.getConnections().length > 0) return;
  const relays = activeRelaysStore.get();
  if (relays.length === 0) return;
  if (DEBUG) console.log("restoreRelay");
  currentRelayIndex = (currentRelayIndex + 1) % relays.length;
  return libp2p.dial(multiaddr(relays[currentRelayIndex])).catch((e) => {
    console.error("Failed to restore relay", e);
  });
}

async function initP2PLeaderboard() {
  if (libp2p) {
    await libp2p.stop();
  }
  const store = new IDBDatastore("keystore");
  await store.open();
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
      bootstrap({
        list: activeRelaysStore.get(),
      }),
      pubsubPeerDiscovery({
        interval: 13e3,
        topics: ["digifall._peer-discovery"],
        listenOnly: false,
      }),
    ],
    connectionGater: {
      denyDialMultiaddr: () => false,
      denyDialPeer(remotePeer) {
        const remotePeerId = remotePeer.toString();
        if (blacklist.has(remotePeerId)) return true;
        if (libp2p.getConnections().length >= 3) return true;
        const hasConnection = libp2p
          .getConnections()
          .some(
            ({ remotePeer, status }) =>
              remotePeer.toString() === remotePeerId && status !== "closed",
          );
        if (hasConnection) return true;
        if (USE_ALL_RELAYS) return false;
        if (relayPeerIdsStore.get().includes(remotePeerId)) {
          return remotePeerId !== getCurrentRelayPeerId();
        }
        return false;
      },
      denyInboundConnection() {
        return libp2p.getConnections().length >= 5;
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
  libp2p.handle(PROTOCOLS.root, handleRoot, {
    runOnLimitedConnection: true,
  });
  libp2p.handle(PROTOCOLS.preview, handlePreview, {
    runOnLimitedConnection: true,
  });
  if (DEBUG) window.libp2p = libp2p;
  if (optionsStore.get().leaderboard) {
    await libp2p.start();
  }
}

setInterval(() => restoreRelay().catch(() => {}), 73e3);

const forceSync = throttle(() => {
  if (!libp2p) return;
  const peerIds = relayPeerIdsStore.get();
  if (peerIds.length === 0) return;
  libp2p
    .getConnections()
    .filter(({ remotePeer, status }) => {
      return status === "open" && !peerIds.includes(remotePeer.toString());
    })
    .forEach(pushRoot);
}, 5e3);

RECORD_TYPES.forEach((type) => {
  const leaderboardStore = leaderboardStores[type];
  leaderboardStore.subscribe(async (leaderboard) => {
    if (!leaderboard || leaderboard.length === 0) return;
    if (core.getData(type).length > 0) {
      const rootPrev = core.getRoots()[type];
      core.updateRoot(type);
      return rootPrev !== core.getRoots()[type] && libp2p && forceSync();
    }
    Promise.allSettled(
      leaderboard.map((record) =>
        validateRecord(record).then((game) => core.handleRecord(game)),
      ),
    ).then(() => leaderboardStore.set(core.getData(type)));
  });
});

recordsStore.subscribe((records) => {
  const phase = phaseStore.get();
  if (phase !== PHASES.idle && phase !== PHASES.gameOver) return;
  RECORD_TYPES.forEach((type) => {
    const record = records[type];
    if (record[KEYS.value] === 0) return;
    record[KEYS.type] = type;
    core.handleRecord(record);
    leaderboardStores[type].set(core.getData(type));
  });
});

let relaysInitialized = false;
const reinitP2P = debounce(() => initP2PLeaderboard(), 3e3);

activeRelaysStore.subscribe(() => {
  if (!relaysInitialized) {
    relaysInitialized = true;
    initP2PLeaderboard().catch(console.error);
    return;
  }
  currentRelayIndex = -1;
  reinitP2P();
});

let prevLeaderboardEnabled = optionsStore.get().leaderboard;
const toggleLeaderboard = debounce(async (enabled) => {
  if (enabled && libp2p && libp2p.status !== "started") await libp2p.start();
  if (!enabled && libp2p && libp2p.status === "started") await libp2p.stop();
}, 3e3);

optionsStore.subscribe(({ leaderboard }) => {
  if (leaderboard !== prevLeaderboardEnabled) {
    prevLeaderboardEnabled = leaderboard;
    toggleLeaderboard(leaderboard);
  }
});

/**
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} delay
 * @returns {T}
 */
export function throttle(fn, delay) {
  let last = 0;
  let pending = null;
  return /** @type {T} */ (
    (...args) => {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        clearTimeout(pending);
        pending = null;
        return fn(...args);
      }
      clearTimeout(pending);
      pending = setTimeout(
        () => {
          last = Date.now();
          pending = null;
          fn(...args);
        },
        delay - (now - last),
      );
    }
  );
}

/**
 * @template {(...args: any[]) => void} T
 * @param {T} fn
 * @param {number} delay
 * @returns {T}
 */
function debounce(fn, delay) {
  let timer;
  return /** @type {T} */ (
    (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    }
  );
}
