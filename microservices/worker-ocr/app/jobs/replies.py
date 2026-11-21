"""Narrowing of Redis replies.

redis-py types every command as "sync or async" (`str | Awaitable[str]`…). The worker
only uses the synchronous client, created with `decode_responses=True`: these helpers
check that at runtime instead of casting.
"""


def as_text(reply: object) -> str | None:
    if reply is None or isinstance(reply, str):
        return reply
    raise TypeError("Unexpected Redis reply: the client must decode responses")


def as_int(reply: object) -> int:
    if isinstance(reply, int):
        return reply
    raise TypeError("Unexpected Redis reply: an integer was expected")
