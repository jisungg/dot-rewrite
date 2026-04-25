"""Semantic-embedding layer.

Primary analysis pathway: dense vector per note → cosine k-NN graph →
Leiden communities. The older fused-signal pipeline (lexical + phrase +
structural + neighborhood + recency) remains as a secondary signal, but
the "topic cluster" shown to the user comes from here.
"""
