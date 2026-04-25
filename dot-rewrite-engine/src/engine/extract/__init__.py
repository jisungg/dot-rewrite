"""Deep-extraction stages for the Nexus intelligence layer.

Stages here run after the existing similarity + Leiden + diagnose pipeline.
They turn raw markdown notes into a structured graph of spans, concepts,
typed relations, role-flagged centrality, and pre-materialized insights
for the Nexus tab to surface.
"""
