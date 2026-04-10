"""
Caching utilities for performance optimization.
Provides in-memory caching for frequently accessed API responses.
"""

import functools
import time
from typing import Any, Callable, Dict, Optional, TypeVar, Union
from datetime import datetime, timedelta
import asyncio

# Type variables for generic caching
T = TypeVar('T')

class CacheEntry:
    """Represents a cached value with TTL support."""
    
    def __init__(self, value: Any, ttl_seconds: int):
        self.value = value
        self.created_at = time.time()
        self.ttl_seconds = ttl_seconds
    
    def is_expired(self) -> bool:
        """Check if cache entry has expired."""
        elapsed = time.time() - self.created_at
        return elapsed > self.ttl_seconds
    
    def __repr__(self):
        remaining = max(0, self.ttl_seconds - (time.time() - self.created_at))
        return f"<CacheEntry ttl_remaining={remaining:.1f}s>"


class InMemoryCache:
    """Simple in-memory cache with TTL support."""
    
    def __init__(self, max_size: int = 1000):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.hits = 0
        self.misses = 0
    
    def set(self, key: str, value: Any, ttl_seconds: int = 300):
        """Store a value in cache with TTL."""
        # Evict oldest entry if cache is full
        if len(self.cache) >= self.max_size:
            oldest_key = min(self.cache.keys(), 
                           key=lambda k: self.cache[k].created_at)
            del self.cache[oldest_key]
        
        self.cache[key] = CacheEntry(value, ttl_seconds)
    
    def get(self, key: str) -> Optional[Any]:
        """Retrieve value from cache if not expired."""
        if key not in self.cache:
            self.misses += 1
            return None
        
        entry = self.cache[key]
        if entry.is_expired():
            del self.cache[key]
            self.misses += 1
            return None
        
        self.hits += 1
        return entry.value
    
    def clear(self):
        """Clear all cache entries."""
        self.cache.clear()
        self.hits = 0
        self.misses = 0
    
    def stats(self) -> Dict[str, Any]:
        """Return cache statistics."""
        total = self.hits + self.misses
        hit_rate = (self.hits / total * 100) if total > 0 else 0
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_percent": round(hit_rate, 2),
            "total_requests": total
        }


# Global cache instances
DOCUMENT_CACHE = InMemoryCache(max_size=500)
CLASSIFICATION_CACHE = InMemoryCache(max_size=1000)
KB_SEARCH_CACHE = InMemoryCache(max_size=100)


def cache_key(*args, **kwargs) -> str:
    """Generate a cache key from function arguments."""
    key_parts = [str(a) for a in args]
    key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
    return "|".join(key_parts)


def cached(ttl_seconds: int = 300, cache_store: Optional[InMemoryCache] = None):
    """
    Decorator for caching function results.
    
    Usage:
        @cached(ttl_seconds=600)
        async def get_document(doc_id: str):
            ...
    
    Args:
        ttl_seconds: Time to live for cached value in seconds
        cache_store: Optional InMemoryCache instance (creates new if None)
    """
    if cache_store is None:
        cache_store = InMemoryCache()
    
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            key = cache_key(*args, **kwargs)
            
            # Try getting from cache
            cached_value = cache_store.get(key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache_store.set(key, result, ttl_seconds)
            return result
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            key = cache_key(*args, **kwargs)
            
            # Try getting from cache
            cached_value = cache_store.get(key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = func(*args, **kwargs)
            cache_store.set(key, result, ttl_seconds)
            return result
        
        # Return appropriate wrapper
        wrapper = async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
        wrapper.cache = cache_store  # type: ignore
        return wrapper
    
    return decorator


def clear_all_caches():
    """Clear all cache stores."""
    DOCUMENT_CACHE.clear()
    CLASSIFICATION_CACHE.clear()
    KB_SEARCH_CACHE.clear()


def get_cache_stats() -> Dict[str, Dict[str, Any]]:
    """Get stats for all cache stores."""
    return {
        "documents": DOCUMENT_CACHE.stats(),
        "classifications": CLASSIFICATION_CACHE.stats(),
        "kb_search": KB_SEARCH_CACHE.stats(),
    }
