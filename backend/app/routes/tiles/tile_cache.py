import time
from collections import OrderedDict
from threading import RLock


class TileCache:
    """Thread-safe LRU cache with TTL for gzip-compressed MVT tiles."""

    def __init__(self, maxsize: int = 3000, ttl: int = 3600) -> None:
        self._store: OrderedDict[str, bytes] = OrderedDict()
        self._timestamps: dict[str, float] = {}
        self.maxsize = maxsize
        self.ttl = ttl
        self._lock = RLock()

    def get(self, key: str) -> bytes | None:
        with self._lock:
            if key not in self._store:
                return None
            if time.monotonic() - self._timestamps[key] > self.ttl:
                del self._store[key]
                del self._timestamps[key]
                return None
            self._store.move_to_end(key)
            return self._store[key]

    def set(self, key: str, value: bytes) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            else:
                while len(self._store) >= self.maxsize:
                    oldest = next(iter(self._store))
                    del self._store[oldest]
                    del self._timestamps[oldest]
            self._store[key] = value
            self._timestamps[key] = time.monotonic()

    def invalidate(self, prefix: str = "") -> int:
        with self._lock:
            if not prefix:
                count = len(self._store)
                self._store.clear()
                self._timestamps.clear()
                return count
            keys = [k for k in list(self._store) if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
                del self._timestamps[k]
            return len(keys)

    @property
    def size(self) -> int:
        return len(self._store)


tile_cache = TileCache(maxsize=3000, ttl=3600)
