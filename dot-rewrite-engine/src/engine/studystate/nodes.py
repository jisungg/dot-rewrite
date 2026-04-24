"""Study-state graph nodes: note / concept / topic."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class NodeKind(str, Enum):
    NOTE = "note"
    CONCEPT = "concept"
    TOPIC = "topic"


@dataclass
class StudyNode:
    id: str
    kind: NodeKind
    label: str
