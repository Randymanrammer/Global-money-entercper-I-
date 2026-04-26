import os
import sys
import logging
import hashlib
from concurrent.futures import ThreadPoolExecutor, as_completed

# --- OMEGA PLATFORM CONFIGURATION ---
VERSION = "100.1.0-STABLE"
FLEET_SIZE = 350
VORTEX_ALGORITHM_MAP = {3: "PRIMARY", 6: "SECONDARY", 9: "DELTA"}

# --- LOGGING SETUP ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [OMEGA-NODE] - %(levelname)s - %(message)s'
)


class InterceptorEngine:
    def __init__(self, node_id):
        self.node_id = node_id
        self.is_active = False
        self._validate_env()

    def _validate_env(self):
        """Ensures a 256-bit Secure Token is present and correctly sized before operation."""
        token = os.getenv("OMEGA_SECURE_TOKEN")
        if not token:
            logging.error(
                "Node %s: OMEGA_SECURE_TOKEN is not set. "
                "A 256-bit secure token is required for operation.",
                self.node_id,
            )
            sys.exit(1)
        if len(token.encode()) < 32:
            logging.error(
                "Node %s: OMEGA_SECURE_TOKEN is too short. "
                "Token must be at least 32 bytes (256 bits).",
                self.node_id,
            )
            sys.exit(1)
        # Log the fingerprint at DEBUG only to avoid leaking token material in
        # production log streams.
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        logging.debug(
            "Node %s: environment validated (token fingerprint: %s...).",
            self.node_id,
            token_hash[:8],
        )
        logging.info("Node %s: environment validated.", self.node_id)

    def activate(self):
        """Bring this node online."""
        if self.is_active:
            logging.warning("Node %s is already active.", self.node_id)
            return
        self.is_active = True
        logging.info("Node %s: activated.", self.node_id)

    def deactivate(self):
        """Take this node offline."""
        if not self.is_active:
            logging.warning("Node %s is already inactive.", self.node_id)
            return
        self.is_active = False
        logging.info("Node %s: deactivated.", self.node_id)

    def _resolve_algorithm(self, payload_size):
        """Map a payload size to a vortex algorithm tier."""
        for threshold in sorted(VORTEX_ALGORITHM_MAP.keys()):
            if payload_size <= threshold:
                return VORTEX_ALGORITHM_MAP[threshold]
        # Payload exceeds all defined thresholds — fall back to DELTA.
        return VORTEX_ALGORITHM_MAP[max(VORTEX_ALGORITHM_MAP)]

    def process(self, payload):
        """
        Process a payload through the appropriate vortex algorithm.

        Returns a dict with the node id, algorithm tier used, and the
        SHA-256 digest of the processed payload.
        """
        if not self.is_active:
            raise RuntimeError(
                f"Node {self.node_id} is inactive. Call activate() first."
            )

        algorithm = self._resolve_algorithm(len(payload))
        digest = hashlib.sha256(payload.encode()).hexdigest()

        logging.info(
            "Node %s: processed %d-byte payload via %s algorithm (digest: %s...).",
            self.node_id,
            len(payload),
            algorithm,
            digest[:8],
        )
        return {"node_id": self.node_id, "algorithm": algorithm, "digest": digest}


# ---------------------------------------------------------------------------
# Fleet-level helpers
# ---------------------------------------------------------------------------

def build_fleet(size=FLEET_SIZE):
    """Instantiate and activate a full fleet of InterceptorEngine nodes."""
    fleet = []
    for i in range(1, size + 1):
        node = InterceptorEngine(node_id=f"NODE-{i:04d}")
        node.activate()
        fleet.append(node)
    logging.info("Fleet of %d nodes is online (version %s).", size, VERSION)
    return fleet


def dispatch_fleet(fleet, payloads, max_workers=32):
    """
    Distribute *payloads* across *fleet* nodes in parallel.

    Each payload is distributed in round-robin fashion to a node.  Results are returned in
    completion order.
    """
    results = []
    tasks = {}

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for idx, payload in enumerate(payloads):
            node = fleet[idx % len(fleet)]
            future = executor.submit(node.process, payload)
            tasks[future] = payload

        for future in as_completed(tasks):
            try:
                results.append(future.result())
            except Exception as exc:
                logging.error("Payload processing failed: %s", exc)

    return results


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    sample_payloads = [
        "transfer:alice->bob:100",
        "transfer:carol->dave:250",
        "transfer:eve->frank:10",
        "audit:ledger:snapshot",
        "sync:node:heartbeat",
    ]

    fleet = build_fleet(size=5)          # small fleet for the demo
    results = dispatch_fleet(fleet, sample_payloads)

    for r in results:
        print(r)
