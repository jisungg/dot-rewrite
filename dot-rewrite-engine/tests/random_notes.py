"""Seeded random note generators per space profile.

Each generator returns (profile_name, notes, gold). Deterministic under a given
seed so test output is reproducible.
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta, timezone

from engine.models import NoteRecord

_NOW = datetime(2026, 4, 20, tzinfo=timezone.utc)


def _mk(title: str, content: str, days_ago: int, space_id: str, tags: list[str] = ()) -> NoteRecord:
    when = _NOW - timedelta(days=days_ago)
    n = NoteRecord(
        id=str(uuid.uuid4()),
        space_id=space_id,
        title=title,
        raw_text=content,
        created_at=when,
        updated_at=when,
    )
    n.tags = list(tags)
    return n


def glossary(seed: int = 1) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    terms = [
        ("Neuron", "single computational unit that applies weights, bias, and activation."),
        ("Weight", "scalar multiplier on an input inside a neural network."),
        ("Bias", "additive parameter before the activation function."),
        ("Activation", "nonlinear function applied to the weighted sum."),
        ("ReLU", "rectified linear activation returning max(0, x)."),
        ("Sigmoid", "squashing activation returning 1 / (1 + e^-x)."),
        ("Softmax", "normalizes a vector into a probability distribution."),
        ("Loss", "scalar measurement of prediction error."),
        ("Gradient", "vector of partial derivatives with respect to parameters."),
        ("Backprop", "algorithm to compute gradients by chain rule."),
        ("Epoch", "one full pass over the training dataset."),
        ("Batch", "subset of training data processed together."),
        ("Optimizer", "rule that updates parameters using gradients."),
        ("Overfitting", "model memorizes the training set and fails to generalize."),
        ("Regularization", "penalty added to the loss to discourage large weights."),
    ]
    rng.shuffle(terms)
    notes = [
        _mk(name, f"{name}: {body}", days_ago=20 - i, space_id=sid, tags=["ml"])
        for i, (name, body) in enumerate(terms[:12])
    ]
    return "glossary", notes, {}


def lecture_dump(seed: int = 2) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    base = """Today's lecture reviewed the full pipeline of machine learning.
We began with data collection, which requires careful sampling and labeling decisions.
Then we discussed feature engineering, including normalization and encoding of categorical variables.
We covered model selection choices: linear models, tree ensembles, and neural networks.
Training involves splitting data into training, validation, and test partitions.
Overfitting and regularization were covered in detail.
We examined loss functions such as cross entropy and mean squared error.
Optimizers included stochastic gradient descent, momentum, and adaptive methods like Adam.
Finally we discussed evaluation metrics: accuracy, precision, recall, F1, and ROC-AUC.
"""
    topics = ["data collection", "feature engineering", "model selection",
              "training dynamics", "regularization strategies", "optimizer choice"]
    rng.shuffle(topics)
    notes = [
        _mk(f"Lecture {i+1}: {t}", f"# Lecture {i+1}: {t}\n\n{base}\n\nFocus: {t}.",
            days_ago=30 - i * 3, space_id=sid, tags=["lecture"])
        for i, t in enumerate(topics[:5])
    ]
    return "lecture_dump", notes, {}


def mixed_subject(seed: int = 3) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    bio = [
        ("Mitosis", "Mitosis: cell division producing two identical diploid daughter cells. Phases: prophase metaphase anaphase telophase."),
        ("Meiosis", "Meiosis: cell division producing four haploid gametes. Two successive divisions meiosis I and meiosis II."),
        ("Osmosis", "Osmosis: movement of water across a semi-permeable membrane down its water potential gradient."),
        ("Photosynthesis", "Photosynthesis converts light energy into chemical energy inside chloroplasts producing glucose."),
    ]
    algo = [
        ("Binary search trees", "BST: left < node < right; supports O(log n) operations when balanced."),
        ("Hash tables", "Hash tables map keys to values via a hash function with average O(1) lookup."),
        ("Graph traversal", "BFS uses a queue; DFS uses a stack or recursion for graph traversal."),
        ("Sorting", "Quick sort and merge sort are comparison-based with O(n log n) average time."),
    ]
    hist = [
        ("French Revolution", "The French Revolution overturned the monarchy and introduced liberty equality fraternity."),
        ("Industrial Revolution", "The Industrial Revolution transformed agrarian societies into factory based economies."),
    ]
    entries = [(n, c, "bio") for n, c in bio] + [(n, c, "algo") for n, c in algo] + [(n, c, "history") for n, c in hist]
    rng.shuffle(entries)
    notes = [
        _mk(name, content, days_ago=25 - i * 2, space_id=sid, tags=[tag])
        for i, (name, content, tag) in enumerate(entries)
    ]
    gold = {
        "topic_groups": [
            [n.id for n in notes if "bio" in n.tags],
            [n.id for n in notes if "algo" in n.tags],
            [n.id for n in notes if "history" in n.tags],
        ],
    }
    return "mixed_subject", notes, gold


def formula_heavy(seed: int = 4) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    physics = [
        ("Newton second law", "F = m a, relates force F to mass m and acceleration a.\nex: pushing a cart with 10N on a 2kg cart yields a = 5 m/s^2."),
        ("Work energy theorem", "W = ∫ F · ds = ΔKE. Work equals change in kinetic energy.\nex: braking a car converts kinetic energy to heat."),
        ("Gravitational potential", "U = - G m1 m2 / r. Negative near bodies, approaches zero at infinity.\nex: satellites bound to Earth have negative U."),
        ("Ohm law", "V = I R. Voltage equals current times resistance.\nex: 5V across a 10Ω resistor yields 0.5A."),
        ("Kirchhoff current", "Σ I_in = Σ I_out at any node.\nex: branching circuit currents balance."),
        ("Coulomb law", "F = k q1 q2 / r^2. Force between point charges.\nex: two 1C charges 1m apart feel 9e9 N."),
        ("Capacitor energy", "U = 1/2 C V^2. Energy stored in a capacitor.\nex: 1F capacitor at 10V stores 50J."),
        ("Simple harmonic", "ω = sqrt(k / m). Angular frequency of SHM.\nex: a 1kg mass on 100 N/m spring oscillates at 10 rad/s."),
    ]
    rng.shuffle(physics)
    notes = [
        _mk(name, body, days_ago=20 - i, space_id=sid, tags=["physics"])
        for i, (name, body) in enumerate(physics)
    ]
    return "formula_heavy", notes, {}


def fragment_heavy(seed: int = 5) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    scraps = [
        "TODO: revisit residual connections", "why does batchnorm help?",
        "dropout rate for small models?", "quick: softmax temperature",
        "re-read gelu paper", "Adam vs AdamW diff",
        "LR warmup steps 1000", "fp16 loss scaling",
        "clip grad norm 1.0", "check rng seed",
        "val loss diverged?", "sanity: overfit 1 batch",
    ]
    notes = [
        _mk(s.split(":")[0][:40] or s[:30], s, days_ago=15 - i, space_id=sid)
        for i, s in enumerate(scraps)
    ]
    return "fragment_heavy", notes, {}


def reflective(seed: int = 6) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    essays = [
        ("On the nature of learning",
         """Reflection on how we come to understand new ideas.
Learning is less a transfer of fact and more a gradual reshaping of internal models through confrontation with unexpected evidence.
The learner holds a prior picture and updates only in response to dissonance between prediction and observation.
A theory of learning that ignores that dissonance misses the essential mechanism."""),
        ("Memory and forgetting",
         """Forgetting is not failure of memory but a necessary condition of recall.
Without decay every trace would remain maximally accessible and interference would dominate.
Selective weakening of rarely used traces shapes the landscape of what can still be retrieved."""),
        ("Attention as selection",
         """Attention is the decision about what to keep processing deeply and what to let fade.
Our limited capacity is not a bug; it is the mechanism by which coherent behavior emerges from a noisy world."""),
        ("Habit and deliberate practice",
         """Habit is a scaffold that frees deliberate practice to operate at the edge of current ability.
Without the scaffolding of habit the costly work of deliberate practice is consumed by friction."""),
    ]
    rng.shuffle(essays)
    notes = [
        _mk(title, body, days_ago=30 - i * 4, space_id=sid, tags=["essay"])
        for i, (title, body) in enumerate(essays)
    ]
    return "reflective", notes, {}


def balanced(seed: int = 7) -> tuple[str, list[NoteRecord], dict]:
    rng = random.Random(seed)
    sid = str(uuid.uuid4())
    notes = []
    # a bit of each: definitions, examples, a summary, a comparison
    items = [
        ("Derivative", "Derivative: instantaneous rate of change of a function. d/dx x^2 = 2x.\nex: velocity is the derivative of position."),
        ("Integral", "Integral: accumulation of a quantity over an interval.\nex: area under a velocity curve gives displacement."),
        ("Limit", "Limit: value a function approaches as input approaches a point.\nex: lim x->0 sin(x)/x = 1."),
        ("Continuity", "Continuity: f is continuous at a if lim x->a f(x) = f(a)."),
        ("Fundamental theorem of calculus", """# Fundamental theorem

Summary:
- integration and differentiation are inverse operations
- ∫_a^b f'(x) dx = f(b) - f(a)

ex: ∫_0^1 2x dx = x^2 evaluated from 0 to 1 = 1
"""),
        ("Derivative vs integral", """# Derivative vs integral

Comparison:
- derivative: rate
- integral: accumulation
- related by the fundamental theorem

ex: differentiate position to get velocity; integrate velocity to recover position
"""),
        ("Why do we study limits?", "why do we introduce limits before derivatives? isn't the derivative more intuitive?"),
        ("Chain rule practice", "# Chain rule practice\n\nex: d/dx sin(x^2) = cos(x^2) · 2x\nex: d/dx e^(3x) = 3 e^(3x)\nex: d/dx ln(x^2 + 1) = 2x / (x^2 + 1)"),
    ]
    rng.shuffle(items)
    for i, (title, content) in enumerate(items):
        notes.append(_mk(title, content, days_ago=18 - i, space_id=sid, tags=["calc"]))
    return "balanced", notes, {}


ALL = [glossary, lecture_dump, mixed_subject, formula_heavy, fragment_heavy, reflective, balanced]
