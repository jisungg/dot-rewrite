"""Lemmatization. spaCy primary, light snowball-stem fallback.

Fallback keeps the script runnable without a large model download.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Callable


@lru_cache(maxsize=1)
def _spacy_pipe():
    import spacy
    try:
        return spacy.load("en_core_web_sm", disable=["ner", "parser"])
    except OSError:
        return None


@lru_cache(maxsize=1)
def _snowball():
    try:
        from nltk.stem.snowball import SnowballStemmer
        return SnowballStemmer("english")
    except Exception:
        return None


def build_lemmatizer(use_spacy: bool = True) -> Callable[[list[str]], list[str]]:
    if use_spacy:
        nlp = _spacy_pipe()
        if nlp is not None:
            def _spacy_fn(tokens: list[str]) -> list[str]:
                doc = nlp(" ".join(tokens))
                return [t.lemma_ for t in doc if not t.is_space]
            return _spacy_fn

    stem = _snowball()
    if stem is not None:
        return lambda tokens: [stem.stem(t) for t in tokens]

    # last-resort: identity (lowercased by normalize already)
    return lambda tokens: list(tokens)
