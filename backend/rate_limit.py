from slowapi import Limiter
from slowapi.util import get_remote_address

# Single shared limiter instance. Both the route decorators and the app's
# exception handler / state must reference the same Limiter for rate limiting
# to be enforced consistently.
limiter = Limiter(key_func=get_remote_address)
