"""Letters: per-discipline expert agents and the seeded reference corpus.

Five disciplines:
    M — Mathematics
    S — Sciences
    C — Computer Science
    P — Philosophy
    H — History

This package owns:
    discipline.py        — per-note discipline classification
    seed_corpus.py       — chunk + embed + write seeded corpus rows
    manifest.json        — auditable list of seeded sources (URL + license + version)
"""

DISCIPLINES = ("M", "S", "C", "P", "H")
DISCIPLINE_NAMES = {
    "M": "Mathematics",
    "S": "Sciences",
    "C": "Computer Science",
    "P": "Philosophy",
    "H": "History",
}
