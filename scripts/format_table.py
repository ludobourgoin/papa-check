#!/usr/bin/env python3
"""Format wrangler d1 execute --json output as a readable table."""
import sys
import json


def main() -> None:
    data = json.load(sys.stdin)
    rows = data[0]["results"]
    if not rows:
        print("  (aucune donnée)")
        return
    keys = list(rows[0].keys())

    def fmt(v: object) -> str:
        return "—" if v is None else str(v)

    widths = [
        max(len(k), max((len(fmt(r[k])) for r in rows), default=0))
        for k in keys
    ]
    print("  " + "  ".join(f"{k:<{w}}" for k, w in zip(keys, widths)))
    print("  " + "  ".join("─" * w for w in widths))
    for r in rows:
        print(
            "  "
            + "  ".join(
                f"{fmt(r[k]):<{w}}" for k, w in zip(keys, widths)
            )
        )


if __name__ == "__main__":
    main()
