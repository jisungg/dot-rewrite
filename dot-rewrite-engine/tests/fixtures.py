"""Synthetic note spaces for evaluation.

Hand-designed to exercise failure modes + include gold labels where useful.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from engine.models import NoteRecord


def _mk(title: str, content: str, days_ago: int, space_id: str) -> NoteRecord:
    now = datetime(2026, 4, 1, tzinfo=timezone.utc)
    when = now - timedelta(days=days_ago)
    return NoteRecord(
        id=str(uuid.uuid4()),
        space_id=space_id,
        title=title,
        raw_text=content,
        created_at=when,
        updated_at=when,
    )


# ---------- Space A: clean biology (photosynthesis vs respiration) ----------

def biology_clean() -> tuple[str, list[NoteRecord], dict]:
    sid = str(uuid.uuid4())
    notes = [
        _mk("Photosynthesis overview", """# Photosynthesis overview

Photosynthesis:
- plants convert light energy into chemical energy
- inputs: water, carbon dioxide, light
- outputs: glucose, oxygen

ex: chloroplasts absorb photons and drive the light reactions
""", 40, sid),
        _mk("Light reactions", """# Light reactions

Light reactions:
- happen in the thylakoid membrane
- photons split water (photolysis)
- produces ATP and NADPH

ex: photosystem II uses light to excite electrons
""", 36, sid),
        _mk("Calvin cycle", """# Calvin cycle

Calvin cycle:
- uses ATP and NADPH from the light reactions
- fixes carbon dioxide into glucose
- runs in the stroma of chloroplasts

ex: rubisco catalyzes the first fixation step
""", 32, sid),
        _mk("Cellular respiration overview", """# Cellular respiration

Cellular respiration:
- breaks down glucose into carbon dioxide and water
- produces ATP for the cell
- three stages: glycolysis, krebs cycle, electron transport chain

ex: mitochondria are the main site of respiration in eukaryotes
""", 22, sid),
        _mk("Glycolysis", """# Glycolysis

Glycolysis:
- converts glucose into two pyruvate molecules
- occurs in the cytoplasm
- yields small amounts of ATP and NADH

ex: hexokinase performs the first phosphorylation
""", 20, sid),
        _mk("Krebs cycle", """# Krebs cycle

Krebs cycle:
- occurs in the mitochondrial matrix
- oxidizes acetyl CoA to carbon dioxide
- produces NADH, FADH2, ATP

ex: citrate synthase begins the cycle
""", 18, sid),
        _mk("Electron transport chain", """# Electron transport chain

Electron transport chain:
- inner mitochondrial membrane proteins
- uses NADH and FADH2 to pump protons
- drives ATP synthase

ex: oxygen is the final electron acceptor
""", 14, sid),
        _mk("Photosynthesis vs respiration", """# Photosynthesis vs respiration

Comparison:
- photosynthesis stores energy, respiration releases it
- photosynthesis consumes CO2 and releases O2
- respiration consumes O2 and releases CO2
- both involve electron transport chains
- both use ATP and proton gradients

ex: leaves photosynthesize during the day but respire all day
""", 10, sid),
    ]
    gold = {
        "related": {
            # overview notes are related to their detail notes
            notes[0].id: [notes[1].id, notes[2].id, notes[7].id],
            notes[3].id: [notes[4].id, notes[5].id, notes[6].id, notes[7].id],
        },
        "topic_groups": [
            [notes[0].id, notes[1].id, notes[2].id],                  # photosynthesis
            [notes[3].id, notes[4].id, notes[5].id, notes[6].id],     # respiration
        ],
        "confusion_pairs": [
            (notes[0].id, notes[3].id),  # photosynthesis vs respiration overviews
        ],
    }
    return "biology_clean", notes, gold


# ---------- Space B: sparse (only 3 short notes) ----------

def sparse_space() -> tuple[str, list[NoteRecord], dict]:
    sid = str(uuid.uuid4())
    notes = [
        _mk("Stack", "Stack: LIFO data structure. push/pop operations.", 5, sid),
        _mk("Queue", "Queue: FIFO data structure. enqueue/dequeue.", 4, sid),
        _mk("Heap", "Heap: priority queue backed by a binary tree.", 3, sid),
    ]
    return "sparse_space", notes, {}


# ---------- Space C: repetitive lecture dumps ----------

def repetitive_lecture() -> tuple[str, list[NoteRecord], dict]:
    sid = str(uuid.uuid4())
    stem = """Machine learning models learn from training data. Training data drives model weights.
Models include linear regression, logistic regression, decision trees. Training requires a loss function.
Loss functions include mean squared error and cross entropy. Gradient descent updates weights."""
    notes = [
        _mk(f"Lecture {i}", f"# Lecture {i}\n\n{stem}\n\nToday we emphasized {topic}.",
            days_ago=30 - i * 2, space_id=sid)
        for i, topic in enumerate([
            "linear regression",
            "logistic regression",
            "decision trees",
            "loss functions",
            "gradient descent",
            "training data",
        ])
    ]
    return "repetitive_lecture", notes, {}


# ---------- Space D: mixed classes (bio + algorithms in one space) ----------

def mixed_classes() -> tuple[str, list[NoteRecord], dict]:
    sid = str(uuid.uuid4())
    notes = [
        _mk("Binary search trees", """# Binary search trees

BST:
- each node has left < node < right
- supports O(log n) lookup, insert, delete when balanced

ex: AVL trees self-balance via rotations
""", 20, sid),
        _mk("Hash tables", """# Hash tables

Hash tables:
- map keys to values via a hash function
- average O(1) lookup

ex: Python dicts are open-addressed hash tables
""", 19, sid),
        _mk("Mitosis", """# Mitosis

Mitosis:
- cell division producing two identical daughter cells
- phases: prophase, metaphase, anaphase, telophase

ex: somatic cells divide by mitosis
""", 15, sid),
        _mk("Meiosis", """# Meiosis

Meiosis:
- cell division producing four haploid gametes
- two divisions: meiosis I and meiosis II

ex: sperm and egg cells are produced by meiosis
""", 12, sid),
        _mk("Graph traversal", """# Graph traversal

Graph traversal:
- BFS uses a queue
- DFS uses a stack or recursion

ex: shortest path uses BFS on unweighted graphs
""", 10, sid),
    ]
    # assign tags so mixed_classes flag triggers
    for i, tag in enumerate(["algo", "algo", "bio", "bio", "algo"]):
        notes[i].tags = [tag]
    gold = {
        "topic_groups": [
            [notes[0].id, notes[1].id, notes[4].id],
            [notes[2].id, notes[3].id],
        ],
        "confusion_pairs": [(notes[2].id, notes[3].id)],
    }
    return "mixed_classes", notes, gold


# ---------- Space E: glossary-heavy (lots of tiny definitions) ----------

def glossary_heavy() -> tuple[str, list[NoteRecord], dict]:
    sid = str(uuid.uuid4())
    defs = [
        ("Neuron", "Neuron: a single computational unit that applies weights, bias, and activation."),
        ("Weight", "Weight: a scalar multiplier applied to an input in a neural network."),
        ("Bias", "Bias: an additive parameter added before the activation function."),
        ("Activation", "Activation: a nonlinear function applied to the weighted sum."),
        ("ReLU", "ReLU: rectified linear activation returning max(0, x)."),
        ("Sigmoid", "Sigmoid: squashing activation returning 1 / (1 + e^-x)."),
        ("Softmax", "Softmax: normalizes a vector into a probability distribution."),
        ("Loss", "Loss: scalar measurement of prediction error."),
        ("Gradient", "Gradient: vector of partial derivatives with respect to parameters."),
        ("Backprop", "Backprop: algorithm to compute gradients by chain rule."),
        ("Epoch", "Epoch: one full pass over the training dataset."),
        ("Batch", "Batch: subset of training data processed together."),
    ]
    notes = [_mk(name, content, 25 - i, sid) for i, (name, content) in enumerate(defs)]
    return "glossary_heavy", notes, {}


ALL = [biology_clean, sparse_space, repetitive_lecture, mixed_classes, glossary_heavy]
