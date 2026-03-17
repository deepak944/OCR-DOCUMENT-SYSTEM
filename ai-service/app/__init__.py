import warnings

try:
    from cryptography.utils import CryptographyDeprecationWarning
except Exception:  # pragma: no cover
    CryptographyDeprecationWarning = Warning

warnings.filterwarnings(
    "ignore",
    message="ARC4 has been moved to cryptography.hazmat.decrepit.ciphers.algorithms.ARC4.*",
    category=CryptographyDeprecationWarning
)
