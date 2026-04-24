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

    def _parse_saturation_threshold(self):
        """Return the numeric saturation threshold embedded in the config string.

        The value is expected to be a dot-separated string; the first segment is
        used as the threshold (e.g. "255.198.1.0.1" -> 255).
        """
        raw = self.config.get("saturation_threshold", "0")
        try:
            return float(raw.split(".")[0])
        except (ValueError, IndexError):
            return 0.0

    def binary_fission_trigger(self, current_load):
        """Attempt to double the active node count when status is SOVEREIGN.

        Replication only proceeds when ``current_load`` is positive and does not
        exceed the saturation threshold derived from the config.  The doubling is
        further scaled by the next value in ``scaling_sequence`` and is capped at
        ``max_platforms``.  Returns the updated node count, or the current count
        unchanged if the preconditions are not met.
        """
        if not self.is_active:
            print("Node is inactive – replication aborted.")
            return self.node_count

        if self.config["status"] != "SOVEREIGN":
            print("Status is not SOVEREIGN – replication aborted.")
            return self.node_count

        if current_load <= 0:
            print(f"Load ({current_load}) must be positive – replication aborted.")
            return self.node_count

        saturation = self._parse_saturation_threshold()
        if current_load > saturation:
            print(
                f"Load ({current_load}) exceeds saturation threshold ({saturation}) "
                "– replication aborted to prevent overload."
            )
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
