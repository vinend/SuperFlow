"""Short-lived, owner-scoped progress; no source text, prompts or model reasoning."""

from collections import OrderedDict
from threading import Lock
from time import monotonic

_lock = Lock()
_entries = OrderedDict()
TTL = 3600
MAX_ENTRIES = 2048


def update(user_id: str, token: str, stage: str, message: str):
    with _lock:
        now = monotonic()
        for key, (created, _) in list(_entries.items()):
            if now - created > TTL:
                del _entries[key]
        _entries[(user_id, token)] = (now, {"stage": stage, "message": message})
        _entries.move_to_end((user_id, token))
        while len(_entries) > MAX_ENTRIES:
            _entries.popitem(last=False)


def read(user_id: str, token: str):
    with _lock:
        entry = _entries.get((user_id, token))
        if entry and monotonic() - entry[0] <= TTL:
            return dict(entry[1])
    return None
