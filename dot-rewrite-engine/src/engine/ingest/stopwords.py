"""Stopword set. NLTK primary, hardcoded fallback."""
from __future__ import annotations

_FALLBACK = {
    "a","an","the","and","or","but","if","then","else","of","in","on","at","to","for",
    "with","by","from","as","is","are","was","were","be","been","being","it","this",
    "that","these","those","i","you","he","she","we","they","them","his","her","our",
    "their","my","your","me","us","so","not","no","do","does","did","have","has","had",
    "can","could","should","would","will","just","also","than","too","very","about","into",
}


def load() -> set[str]:
    try:
        from nltk.corpus import stopwords  # type: ignore
        return set(stopwords.words("english"))
    except Exception:
        return set(_FALLBACK)
