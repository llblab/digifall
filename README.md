# [DIGIFALL](https://digifall.app)

[<img alt="Get it on Google Play" src="public/images/get-it-on-google-play.png" />](https://play.google.com/store/apps/details?id=com.llblab.digifall "Get it on Google Play")

> Entropy fighting mathematactic game

A deterministic survival puzzle game begins with a reserve of 100 energy points. Each move, which increment a card's value by one, consumes 10 points from this reserve. Adjacent cards with identical values merge to form a cluster, when a cards values matches the cluster's size, the cluster is eliminated, replenishing your energy by an amount equal to the cards values. The player's objective is to survive as long as possible while accumulating the highest score achievable. The game features a decentralized leaderboard with 1000 slots, allowing you to immortalize your string name. The integrity of game records is ensured through validation mechanisms implemented directly on each game client.

[<img alt="digifall.app" src="public/images/screenshot_alt_0.png" />](https://digifall.app "https://digifall.app")[<img alt="digifall.app" src="public/images/screenshot_alt_1.png" />](https://digifall.app "https://digifall.app")

# Architecture

- `Immortal Software`: A protocol-as-game designed to survive without central servers
- `Deterministic Core`: All game logic is seeded and reproducible
- `Trustless P2P`: Leaderboard data synchronizes via libp2p relays
- `Domain DAG`: `domain-dag.json` records the intended dependency layers and boundary checks; the validator skill is vendored in `.agents/skills/domain-dag`

# Project Control

- [Agent protocol](AGENTS.md)
- [Backlog](BACKLOG.md)
- [Changelog](CHANGELOG.md)
- [Docs index](docs/README.md)

# Server Nodes

## Prerequisites

- A server running Linux (Debian/Ubuntu or RHEL/CentOS/Fedora)
- Root access to the server
- A domain name pointing to your server (for SSL certificate)
- Node.js v22+ with npm (the relay installer provisions Node 26 via fnm if no suitable runtime is available)

## Relay Node

Circuit relay for NAT traversal, enabling browser peers to connect.

```bash
curl -fsSL https://raw.githubusercontent.com/llblab/digifall/main/scripts/deploy-relay.sh -o deploy-relay.sh
chmod +x deploy-relay.sh
sudo ./deploy-relay.sh
```

The installer reuses an existing Node.js ≥22 with its matching npm when both work as the `digifall` service user. It does not upgrade the system Node/npm. Otherwise it installs fnm and Node **26.x** in the root-owned `/opt/digifall-runtime` directory, without changing shell profiles or global symlinks. The major is fixed; the initial installation resolves a matching patch version. Systemd runs the resolved Node binary directly, without npm or an fnm shell environment.

To remove the relay:

```bash
curl -fsSL https://raw.githubusercontent.com/llblab/digifall/main/scripts/undeploy-relay.sh -o undeploy-relay.sh
chmod +x undeploy-relay.sh
sudo ./undeploy-relay.sh
```

Uninstallation leaves Node/npm and `/opt/digifall-runtime` intact. Automatic application-directory deletion is limited to the canonical `/opt/digifall` path; custom installations require manual directory cleanup. Non-interactive removal defaults to deleting the application, service user, and certificate; set `REMOVE_APP=n`, `REMOVE_USER=n`, or `REMOVE_CERT=n` to retain them.

## Leaderboard Node

Headless leaderboard peer for network bootstrapping and data persistence.

```bash
git clone https://github.com/llblab/digifall.git
cd digifall
npm install
npm run leaderboard
```

Custom relays via environment variable:

```bash
DIGIFALL_RELAYS="/dns4/your.relay/tcp/443/wss/p2p/12D3KooW..." npm run leaderboard
```
