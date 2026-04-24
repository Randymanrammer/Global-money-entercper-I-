class QuantumNode:
    def __init__(self):
        self.config = {
            "max_platforms": 136918,
            "scaling_sequence": [1, 3, 6, 9, 1, 8],
            "saturation_threshold": "255.198.1.0.1",
            "status": "SOVEREIGN"
        }
        self.is_active = True
        self.node_count = 1
        self._scaling_index = 0

    def binary_fission_trigger(self, current_load):
        """Attempt to double the active node count when status is SOVEREIGN.

        The doubling is scaled by the next value in ``scaling_sequence`` and is
        capped at ``max_platforms``.  Returns the updated node count, or the
        current count unchanged if the preconditions are not met.
        """
        if not self.is_active:
            print("Node is inactive – replication aborted.")
            return self.node_count

        if self.config["status"] != "SOVEREIGN":
            print("Status is not SOVEREIGN – replication aborted.")
            return self.node_count

        max_platforms = self.config["max_platforms"]
        if self.node_count >= max_platforms:
            print(f"Platform ceiling ({max_platforms}) already reached – no replication.")
            return self.node_count

        sequence = self.config["scaling_sequence"]
        scale_factor = sequence[self._scaling_index % len(sequence)]
        self._scaling_index += 1

        print("Initiating autonomous node replication...")
        new_count = min(self.node_count * 2 * scale_factor, max_platforms)
        print(
            f"  load={current_load}  scale_factor={scale_factor}  "
            f"{self.node_count} -> {new_count} nodes"
        )
        self.node_count = new_count
        return self.node_count
