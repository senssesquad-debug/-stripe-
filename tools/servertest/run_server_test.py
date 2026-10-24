"""Dedicated-server smoke test for Lost Features.

Starts `./gradlew runServer`, waits for the server to be ready, sends a plan of console commands
(placing every structure, spawning every creature, starting every event, generating Far Lands
chunks, probing blocks), then stops the server and writes the full log. Afterwards it scans for
errors. Usage: python3 tools/servertest/run_server_test.py [logfile]
"""
import os
import re
import socket
import struct
import subprocess
import sys
import threading
import time

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "build", "server_test.log")
MODE = sys.argv[2] if len(sys.argv) > 2 else "full"

STRUCTURES = ['starting_house', 'brick_pyramid', 'obsidian_wall', 'glass_pillar', 'monolith', 'ancient_ruins', 'dragon_lair']

PLAN = [
    # (delay seconds before command, command)
    (0, "lostfeatures memory"),
    (0, "forceload add -96 -96 96 96"),
    (8, "summon lostfeatures:red_dragon 0 120 0"),
    (0, "summon lostfeatures:giant 20 100 20"),
    (0, "summon lostfeatures:illusioner -20 100 -20"),
    (0, "summon lostfeatures:killer_bunny 10 100 -10"),
    (0, "summon minecraft:cow 12 100 12"),
    (10, "execute as @e[type=lostfeatures:red_dragon] run data get entity @s Health"),
    (0, "execute as @e[type=lostfeatures:red_dragon] run data get entity @s Pos"),
    (0, "execute as @e[type=lostfeatures:giant] run data get entity @s Health"),
    (0, "lostfeatures event start dragon_hunting_grounds 40 ~ -40"),
    (0, "kill @e[type=lostfeatures:red_dragon]"),
    (1, "lostfeatures event start dragon_hunting_grounds 40 ~ -40"),
    (0, "lostfeatures event start ancient_disturbance 0 ~ 0"),
    (0, "lostfeatures event start illager_expedition 30 ~ 30"),
    (0, "lostfeatures event start village_under_threat -40 ~ 40"),
    (2, "lostfeatures event list"),
    (15, "execute as @e[type=lostfeatures:red_dragon] run data get entity @s Pos"),
    (0, "lostfeatures event list"),
    (30, "lostfeatures event list"),
    (0, "kill @e[type=lostfeatures:giant]"),
    (0, "kill @e[type=lostfeatures:killer_bunny]"),
    (0, "kill @e[type=lostfeatures:illusioner]"),
    (0, "kill @e[type=lostfeatures:red_dragon]"),
    (12, "lostfeatures event list"),
    (0, "lostfeatures memory"),
    (0, "forceload remove all"),
]
for i, name in enumerate(STRUCTURES):
    x = 600 + 300 * i
    PLAN += [
        (0, f"forceload add {x - 48} -48 {x + 48} 48"),
        (6, f"place structure lostfeatures:{name} {x} ~ 0"),
        (1, f"forceload remove {x - 48} -48 {x + 48} 48"),
    ]
PLAN += [
    (0, "locate structure lostfeatures:ancient_ruins"),
    (0, "locate structure lostfeatures:brick_pyramid"),
    (0, "execute in lostfeatures:far_lands run forceload add 0 0 47 47"),
    (15, "execute in lostfeatures:far_lands run forceload query 0 0"),
] + [
    (0, f"execute in lostfeatures:far_lands if block {x} {y} 8 minecraft:air") for x in (8, 40) for y in (40, 100, 160, 220, 300)
] + [
    (0, "execute in lostfeatures:far_lands run forceload remove all"),
    (2, "save-all flush"),
    (5, "stop"),
]


DISABLED_PLAN = [
    (0, "locate structure lostfeatures:ancient_ruins"),
    (0, "forceload add -48 -48 48 48"),
    (6, "lostfeatures event start dragon_hunting_grounds 0 ~ 0"),
    (0, "lostfeatures event start ancient_disturbance 0 ~ 0"),
    (0, "summon lostfeatures:red_dragon 0 100 0"),
    (0, "summon lostfeatures:giant 10 100 10"),
    (5, "execute as @e[type=lostfeatures:red_dragon] run data get entity @s Health"),
    (0, "kill @e[type=lostfeatures:red_dragon]"),
    (0, "kill @e[type=lostfeatures:giant]"),
    (0, "lostfeatures memory"),
    (0, "execute in lostfeatures:far_lands run forceload add 0 0 15 15"),
    (5, "execute in lostfeatures:far_lands if block 8 160 8 minecraft:air"),
    (0, "execute in lostfeatures:far_lands run forceload remove all"),
    (0, "forceload remove all"),
    (2, "stop"),
]


class Rcon:
    """Minimal Source RCON client (the protocol vanilla dedicated servers implement)."""

    def __init__(self, host="127.0.0.1", port=25575, password="lostfeatures-test"):
        self.sock = socket.create_connection((host, port), timeout=60)
        self.req = 0
        self._send(3, password)
        self._recv()

    def _send(self, kind, body):
        self.req += 1
        payload = struct.pack("<ii", self.req, kind) + body.encode("utf-8") + b"\x00\x00"
        self.sock.sendall(struct.pack("<i", len(payload)) + payload)

    def _recv(self):
        size = struct.unpack("<i", self._read(4))[0]
        data = self._read(size)
        return data[8:-2].decode("utf-8", "replace")

    def _read(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.sock.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("rcon closed")
            buf += chunk
        return buf

    def command(self, cmd):
        self._send(2, cmd)
        return self._recv()


def main():
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    proc = subprocess.Popen(["./gradlew", "runServer", "--console=plain"], cwd=ROOT, stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    lines = []
    ready = threading.Event()

    def reader():
        for line in proc.stdout:
            lines.append(line)
            if "Done (" in line and "For help" in line:
                ready.set()

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    if not ready.wait(900):
        proc.kill()
        print("server did not start in time")
    else:
        time.sleep(2)
        rcon = Rcon()
        for delay, cmd in (DISABLED_PLAN if MODE == "disabled" else PLAN):
            time.sleep(delay + 0.3)
            try:
                reply = rcon.command(cmd)
            except Exception as e:  # server stopping closes the socket
                reply = f"<{e}>"
            lines.append(f">>> {cmd}\n<<< {reply}\n")
        try:
            proc.wait(300)
        except subprocess.TimeoutExpired:
            proc.kill()
    t.join(5)
    with open(LOG, "w") as f:
        f.writelines(lines)
    text = "".join(lines)
    errors = [l for l in lines if re.search(r"\b(ERROR|Exception|FATAL)\b", l) and "Advanced terminal" not in l]
    print(f"log: {LOG} ({len(lines)} lines); error lines: {len(errors)}")
    for l in errors[:40]:
        print("  ", l.rstrip()[:300])


if __name__ == "__main__":
    main()
