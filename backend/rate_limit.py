from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance. Both the route decorators and the app's
# exception handler / state must reference the same Limiter for rate limiting
# to be enforced consistently.


def _get_real_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=_get_real_ip)
