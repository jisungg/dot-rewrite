# Graph Report - /Users/jisung/dot-rewrite  (2026-04-24)

## Corpus Check
- 199 files · ~95,998 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 919 nodes · 1745 edges · 91 communities detected
- Extraction: 71% EXTRACTED · 29% INFERRED · 0% AMBIGUOUS · INFERRED: 512 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Score Calibration & Diagnostics|Score Calibration & Diagnostics]]
- [[_COMMUNITY_Web Auth Actions|Web Auth Actions]]
- [[_COMMUNITY_Engine Config & Ingest Normalize|Engine Config & Ingest Normalize]]
- [[_COMMUNITY_Confusion Detection|Confusion Detection]]
- [[_COMMUNITY_Eval Fixtures & Synthetic Notes|Eval Fixtures & Synthetic Notes]]
- [[_COMMUNITY_Project Docs & Repo Overview|Project Docs & Repo Overview]]
- [[_COMMUNITY_Concept Canonicalization (PhrasesLemma)|Concept Canonicalization (Phrases/Lemma)]]
- [[_COMMUNITY_Supabase Postgres Store|Supabase Postgres Store]]
- [[_COMMUNITY_Blog & Changelog Pages|Blog & Changelog Pages]]
- [[_COMMUNITY_Co-occurrence & Lexical Similarity|Co-occurrence & Lexical Similarity]]
- [[_COMMUNITY_Dashboard Dot Editor & Icons|Dashboard Dot Editor & Icons]]
- [[_COMMUNITY_Note Editor Component|Note Editor Component]]
- [[_COMMUNITY_Color Utils & Add-Space Dialog|Color Utils & Add-Space Dialog]]
- [[_COMMUNITY_Centrality & Bridge Notes|Centrality & Bridge Notes]]
- [[_COMMUNITY_Rankings & Roles (FoundationalGaps)|Rankings & Roles (Foundational/Gaps)]]
- [[_COMMUNITY_Notes List UI|Notes List UI]]
- [[_COMMUNITY_Nexus Graph Visualization|Nexus Graph Visualization]]
- [[_COMMUNITY_Theme Provider & Outline|Theme Provider & Outline]]
- [[_COMMUNITY_University Logo Assets|University Logo Assets]]
- [[_COMMUNITY_Drawer UI Primitive|Drawer UI Primitive]]
- [[_COMMUNITY_Topic Identity Across Runs|Topic Identity Across Runs]]
- [[_COMMUNITY_Error Boundary & PDF Export|Error Boundary & PDF Export]]
- [[_COMMUNITY_Dialog UI Primitive|Dialog UI Primitive]]
- [[_COMMUNITY_Stage Budgets  Fail-Soft|Stage Budgets / Fail-Soft]]
- [[_COMMUNITY_Incremental Local Recompute|Incremental Local Recompute]]
- [[_COMMUNITY_Auth Form Validation|Auth Form Validation]]
- [[_COMMUNITY_Space TLDR Summarization|Space TLDR Summarization]]
- [[_COMMUNITY_Topic Rollup Compression|Topic Rollup Compression]]
- [[_COMMUNITY_kNN Graph Builder|kNN Graph Builder]]
- [[_COMMUNITY_Structural vs Interpretive Confidence|Structural vs Interpretive Confidence]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 174|Community 174]]

## God Nodes (most connected - your core abstractions)
1. `run_analysis()` - 53 edges
2. `NoteRecord` - 43 edges
3. `GET()` - 42 edges
4. `SimilarityEdge` - 25 edges
5. `FeatureFlags` - 24 edges
6. `TopicCluster` - 23 edges
7. `GatePolicy` - 22 edges
8. `GateOutcome` - 19 edges
9. `createClient()` - 19 edges
10. `NoteRole` - 18 edges

## Surprising Connections (you probably didn't know these)
- `Knowledge graph from uploaded materials (concept)` --semantically_similar_to--> `Engine overview (what it does)`  [INFERRED] [semantically similar]
  dot-rewrite-web/src/data/blogs/mdx/launch.mdx → dot-rewrite-engine/README.md
- `graphify project rules` --references--> `dot-rewrite monorepo`  [INFERRED]
  CLAUDE.md → README.md
- `Build canonical-term map across a space.` --uses--> `NoteRecord`  [INFERRED]
  /Users/jisung/dot-rewrite/dot-rewrite-engine/src/engine/ingest/canonical.py → /Users/jisung/dot-rewrite/dot-rewrite-engine/src/engine/models.py
- `dot-rewrite-web (root README section)` --references--> `Web stack (Next 16, Bun, Tailwind v4, Supabase SSR)`  [INFERRED]
  README.md → dot-rewrite-web/README.md
- `dot-rewrite-engine (root README section)` --references--> `Engine overview (what it does)`  [INFERRED]
  README.md → dot-rewrite-engine/README.md

## Hyperedges (group relationships)
- **End-to-end data pipeline: web editor -> Supabase -> engine -> Supabase -> web nexus** — readme_webdataflow, readme_enginepipeline, readme_enginetables, readme_webkeyfiles, readme_analyzespacecli [EXTRACTED 1.00]
- **Engine resilience: budgets + feature flags + golden_v1 preset + fail-soft + schema idempotence** — readme_enginebudget, readme_enginefeatureflags, readme_schemasql, readme_enginepipeline [EXTRACTED 1.00]
- **Web conventions bundle: Next 16 + Bun + Tailwind dark pairing + Supabase SSR + user prefs + dirty guards** — agents_nextjsrules, agents_bunonly, agents_darkmode, agents_userpreferences, agents_editor, agents_settings [EXTRACTED 1.00]
- **Admissions-related university brand assets** — cambridge_logo_png_cambridge, cambridge_logo_svg_cambridge, harvard_logo_harvard, berkeley_logo_berkeley, mit_logo_mit, oxford_logo_oxford, columbia_logo_columbia, yale_logo_png_yale, stanford_logo_stanford, chicago_logo_chicago, yale_logo_svg_yale, princeton_logo_princeton [INFERRED 0.85]
- **create-next-app default SVG icon set** — file_svg_icon, vercel_svg_logo, next_svg_logo, globe_svg_icon, window_svg_icon [INFERRED 0.90]

## Communities

### Community 0 - "Score Calibration & Diagnostics"
Cohesion: 0.06
Nodes (88): calibrate_list(), calibrate_map(), _percentile(), Score calibration layer.  Raw scores from different rankings are not directly co, Calibrate a parallel list of raw scores. Length preserved., regime_for(), RegimeBands, build_igraph() (+80 more)

### Community 1 - "Web Auth Actions"
Cohesion: 0.08
Nodes (44): checkEmailExists(), encodedRedirect(), forgotPasswordAction(), getUser(), originFromHeaders(), resetPasswordAction(), signInAction(), signOutAction() (+36 more)

### Community 2 - "Engine Config & Ingest Normalize"
Cohesion: 0.1
Nodes (40): Config, config_hash(), FusionWeights, GraphParams, load(), load_for_test(), Runtime config: env vars, fusion weights, graph params, versioned presets., SectionWeights (+32 more)

### Community 3 - "Confusion Detection"
Cohesion: 0.15
Nodes (23): _build_profile(), _cross_cluster_sim(), detect(), _discriminators(), Confusion detection: closeness / separability.  Closeness signals: cross-cluster, _role_mix_sim(), _TopicProfile, confusion_recall() (+15 more)

### Community 4 - "Eval Fixtures & Synthetic Notes"
Cohesion: 0.2
Nodes (20): biology_clean(), glossary_heavy(), mixed_classes(), _mk(), Synthetic note spaces for evaluation.  Hand-designed to exercise failure modes +, repetitive_lecture(), sparse_space(), NodeKind (+12 more)

### Community 5 - "Project Docs & Repo Overview"
Cohesion: 0.09
Nodes (26): Repo state caveman summary, graphify project rules, Edge function process-note feature table, Getting Started with .note (blog post), Knowledge graph from uploaded materials (concept), processDocument example function, analyze_space.py CLI entrypoint, Data flow: web -> Supabase -> engine -> Supabase -> web (+18 more)

### Community 6 - "Concept Canonicalization (Phrases/Lemma)"
Cohesion: 0.15
Nodes (15): apply(), build_mapping(), _canonical_phrase(), Concept canonicalization: collapse variants of the same term.  Rules (no ML):, Build canonical-term map across a space., _singularize(), build_lemmatizer(), Lemmatization. spaCy primary, light snowball-stem fallback.  Fallback keeps the (+7 more)

### Community 7 - "Supabase Postgres Store"
Cohesion: 0.18
Nodes (16): connect(), Supabase Postgres connection helper (psycopg3)., _as_dt(), fetch_space_notes(), Read notes for a space from Supabase Postgres.  Matches Next.js Note type: id, u, main(), finish_run(), replace_confusion_pairs() (+8 more)

### Community 8 - "Blog & Changelog Pages"
Cohesion: 0.11
Nodes (9): BlogContent(), formatDate(), getAllTags(), getBlogPostBySlug(), getBlogPostsByTag(), ChangelogContent(), NotFound(), BlogHome() (+1 more)

### Community 9 - "Co-occurrence & Lexical Similarity"
Cohesion: 0.17
Nodes (14): build(), CoocGraph, neighborhood_overlap(), Keyword co-occurrence graph.  Builds a term-term graph where terms that repeated, Jaccard over union of concept neighborhoods of each note's top terms., bm25_scores(), build_tfidf(), LexicalSpace (+6 more)

### Community 10 - "Dashboard Dot Editor & Icons"
Cohesion: 0.17
Nodes (16): ArtificialIntelligence04Icon(), DeletePutBackIcon(), fetch(), getSelectionText(), handleHistorySelect(), handleInputChange(), handleInputSubmit(), WorkHistoryIcon() (+8 more)

### Community 11 - "Note Editor Component"
Cohesion: 0.23
Nodes (15): fetchAndAssignProfile(), handleAddTag(), handleChange(), handleClickOutside(), handleEditorScroll(), handleHoldEnd(), handleHoldStart(), handleKeyDown() (+7 more)

### Community 12 - "Color Utils & Add-Space Dialog"
Cohesion: 0.2
Nodes (10): handleSubmit(), hexValid(), validate(), generateLightColor(), hexToRgba(), async(), cn(), compute() (+2 more)

### Community 13 - "Centrality & Bridge Notes"
Cohesion: 0.19
Nodes (9): betweenness(), cross_community_nodes(), Bridge notes: high betweenness + cross-community., eigenvector(), pagerank(), Centrality → foundational notes., orphans(), Orphan detection: notes with few/weak edges. (+1 more)

### Community 14 - "Rankings & Roles (Foundational/Gaps)"
Cohesion: 0.33
Nodes (10): foundational_notes(), prerequisite_gaps(), RankedItem, related_notes(), strongest_confusion(), weakest_topics(), apply(), classify() (+2 more)

### Community 15 - "Notes List UI"
Cohesion: 0.26
Nodes (12): formatDate(), handleArchive(), handleClickOutside(), handleDuplicate(), handleEdit(), handleExport(), handleMoveToSpace(), handlePin() (+4 more)

### Community 16 - "Nexus Graph Visualization"
Cohesion: 0.28
Nodes (11): getConnectedLinks(), getConnectedNodes(), handleZoom(), linkColor(), nodeIcon(), onMouseDown(), onMouseMove(), onMouseUp() (+3 more)

### Community 17 - "Theme Provider & Outline"
Cohesion: 0.26
Nodes (8): extractHeadings(), toggle(), applyThemeClass(), readStoredTheme(), systemPrefersDark(), ThemeProvider(), useTheme(), writeStoredTheme()

### Community 18 - "University Logo Assets"
Cohesion: 0.17
Nodes (12): UC Berkeley logo, University of Cambridge logo (PNG), University of Cambridge logo (SVG), University of Chicago logo, Columbia University logo, Harvard University logo, MIT logo, University of Oxford logo (+4 more)

### Community 19 - "Drawer UI Primitive"
Cohesion: 0.33
Nodes (9): Drawer(), DrawerClose(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle() (+1 more)

### Community 20 - "Topic Identity Across Runs"
Cohesion: 0.35
Nodes (7): align(), _jaccard(), PriorTopic, Persistent topic identity across runs.  Aligns newly-detected clusters to prior, term_signature_hash(), build(), _role_mix()

### Community 21 - "Error Boundary & PDF Export"
Cohesion: 0.24
Nodes (3): ErrorBoundary, exportNoteAsPdf(), sanitizeFilename()

### Community 22 - "Dialog UI Primitive"
Cohesion: 0.36
Nodes (8): cn(), Dialog(), DialogClose(), DialogDescription(), DialogHeader(), DialogOverlay(), DialogPortal(), DialogTrigger()

### Community 23 - "Stage Budgets / Fail-Soft"
Cohesion: 0.46
Nodes (6): Stage budgets + fail-soft orchestration.  Each pipeline stage declares a budget, run_stage(), StageBudget, StageTimeout, _timeout(), Exception

### Community 24 - "Incremental Local Recompute"
Cohesion: 0.48
Nodes (5): apply_delta(), DeltaScope, plan_delta(), First-class incremental path.  Bounded locality: single note edit touches only, Reserved: delta application wired once pipeline supports partial runs.

### Community 25 - "Auth Form Validation"
Cohesion: 0.67
Nodes (5): handleBlur(), handleChange(), handleSubmit(), validateField(), validateForm()

### Community 26 - "Space TLDR Summarization"
Cohesion: 0.57
Nodes (5): buildNoteSummary(), buildSpaceSummary(), copy(), stripMd(), truncate()

### Community 27 - "Topic Rollup Compression"
Cohesion: 0.67
Nodes (4): finalize_topic(), Progressive compression: note-level -> topic-level -> space-level., topic_keywords(), topic_label()

### Community 28 - "kNN Graph Builder"
Cohesion: 0.6
Nodes (4): build_knn_edges(), k-NN graph with aggressive edge discipline.  Pipeline:   1. Candidate pass: lexi, topk_from_scores(), _view_confidence()

### Community 29 - "Structural vs Interpretive Confidence"
Cohesion: 0.53
Nodes (4): confusion_interpretive_confidence(), coverage_interpretive_confidence(), Structural certainty vs interpretive confidence.  structural_certainty: how firm, topic_structural_certainty()

### Community 30 - "Community 30"
Cohesion: 0.6
Nodes (4): createVariantsWithTransition(), getBlurClass(), hasTransition(), splitText()

### Community 31 - "Community 31"
Cohesion: 0.53
Nodes (4): cn(), CommandEmpty(), CommandInput(), CommandList()

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (6): File document icon (SVG), Globe / world icon (SVG), Next.js wordmark logo (SVG), create-next-app boilerplate assets, Vercel triangle logo (SVG), Browser window icon (SVG)

### Community 33 - "Community 33"
Cohesion: 0.7
Nodes (3): _heading_terms(), Structural overlap: shared titles/headings/definition terms.  Notes that share h, score()

### Community 34 - "Community 34"
Cohesion: 0.6
Nodes (3): validateEmail(), validateName(), validatePassword()

### Community 35 - "Community 35"
Cohesion: 0.6
Nodes (3): Tabs(), TabsList(), TabsTrigger()

### Community 36 - "Community 36"
Cohesion: 0.6
Nodes (3): CardDescription(), CardFooter(), cn()

### Community 37 - "Community 37"
Cohesion: 0.6
Nodes (3): Accordion(), AccordionItem(), AccordionTrigger()

### Community 38 - "Community 38"
Cohesion: 0.6
Nodes (3): Avatar(), AvatarFallback(), AvatarImage()

### Community 39 - "Community 39"
Cohesion: 0.6
Nodes (3): cn(), DropdownMenu(), DropdownMenuSubContent()

### Community 40 - "Community 40"
Cohesion: 0.8
Nodes (3): handleFeatureClick(), startProgress(), startRotation()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (2): hac(), Hierarchical agglomerative subclustering inside each community.

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (2): Recency / temporal proximity weighting.  Two notes written close in time are mor, score()

### Community 43 - "Community 43"
Cohesion: 0.67
Nodes (2): Phrase overlap similarity: weighted Jaccard over detected multi-word phrases., score()

### Community 44 - "Community 44"
Cohesion: 0.67
Nodes (2): Integration score: how well a new note attaches to the existing topic graph., score()

### Community 45 - "Community 45"
Cohesion: 0.67
Nodes (2): Fragmentation: topic spans many notes but internal connectivity is weak., score()

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (2): Popover(), PopoverTrigger()

### Community 47 - "Community 47"
Cohesion: 0.67
Nodes (2): loadMore(), selectTag()

### Community 48 - "Community 48"
Cohesion: 0.67
Nodes (2): buildOutlinePlaceholder(), buildTldrPlaceholder()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (2): ScrollArea(), ScrollBar()

### Community 50 - "Community 50"
Cohesion: 0.5
Nodes (4): Rule: bun only, no npm/pnpm/yarn, Next.js agent rules (read node_modules docs), dot-rewrite-web/CLAUDE.md -> AGENTS.md alias, Web agent rules summary

### Community 51 - "Community 51"
Cohesion: 0.5
Nodes (4): Dark mode conventions (class-based, token pairing), Settings conventions (SettingsApi pattern), User preferences schema + persistence, Settings feature table

### Community 52 - "Community 52"
Cohesion: 0.5
Nodes (4): Editor conventions (EditorApi, dirty calc, save path), Editor feature table, .note Beta Launch v1.0.0 changelog, v1.0.0 shipped features (collab, sync, markdown, analytics, cross-platform)

### Community 53 - "Community 53"
Cohesion: 0.67
Nodes (1): Entrypoint: python analyze_space.py --space-id 123

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (1): json()

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (1): RootLayout()

### Community 56 - "Community 56"
Cohesion: 0.67
Nodes (1): Loading()

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (1): PricingHome()

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (1): SignInPage()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (1): createClient()

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (1): HoverCard()

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (1): GradientText()

### Community 62 - "Community 62"
Cohesion: 0.67
Nodes (1): Label()

### Community 63 - "Community 63"
Cohesion: 0.67
Nodes (1): TooltipContent()

### Community 64 - "Community 64"
Cohesion: 0.67
Nodes (1): AnimatedGradientText()

### Community 65 - "Community 65"
Cohesion: 0.67
Nodes (1): Badge()

### Community 66 - "Community 66"
Cohesion: 0.67
Nodes (1): Separator()

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (1): cn()

### Community 68 - "Community 68"
Cohesion: 0.67
Nodes (1): Checkbox()

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (1): Spinner()

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (1): cn()

### Community 71 - "Community 71"
Cohesion: 0.67
Nodes (1): Input()

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (1): DialogEnhanced()

### Community 73 - "Community 73"
Cohesion: 0.67
Nodes (1): SmtpMessage()

### Community 74 - "Community 74"
Cohesion: 0.67
Nodes (1): AuthLayout()

### Community 75 - "Community 75"
Cohesion: 0.67
Nodes (1): Footer()

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (1): Header()

### Community 77 - "Community 77"
Cohesion: 0.67
Nodes (1): FeaturedPost()

### Community 78 - "Community 78"
Cohesion: 0.67
Nodes (1): cn()

### Community 79 - "Community 79"
Cohesion: 0.67
Nodes (1): UnrenderableContent()

### Community 80 - "Community 80"
Cohesion: 0.67
Nodes (1): PricingFaq()

### Community 81 - "Community 81"
Cohesion: 0.67
Nodes (1): useDebounce()

### Community 82 - "Community 82"
Cohesion: 0.67
Nodes (1): useMediaQuery()

### Community 83 - "Community 83"
Cohesion: 0.67
Nodes (1): cn()

### Community 84 - "Community 84"
Cohesion: 1.0
Nodes (2): Note view modal conventions, Notes view feature table

### Community 85 - "Community 85"
Cohesion: 1.0
Nodes (2): Nexus conventions (d3 force graph), Nexus feature table

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (2): Dot conventions (mock 50s wait), Dot (agent) feature table

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (2): Dashboard card shell (1600x1000, 200px sidebar), Core shell feature table

### Community 88 - "Community 88"
Cohesion: 1.0
Nodes (2): Spaces dialog conventions, Spaces feature table

### Community 89 - "Community 89"
Cohesion: 1.0
Nodes (2): Cross-cutting web conventions (toasts, ErrorBoundary, auth redirects), Cross-cutting feature table

### Community 174 - "Community 174"
Cohesion: 1.0
Nodes (1): Princeton University logo

## Knowledge Gaps
- **47 isolated node(s):** `Reserved: delta application wired once pipeline supports partial runs.`, `Score every note against a token query (retrieval-flavor probe).`, `Jaccard over union of concept neighborhoods of each note's top terms.`, `graphify project rules`, `Engine stack (Python 3.12, uv, igraph, leidenalg, sklearn, gensim, nltk, spaCy)` (+42 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 41`** (4 nodes): `subcluster.py`, `hac()`, `Hierarchical agglomerative subclustering inside each community.`, `subcluster.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (4 nodes): `recency.py`, `Recency / temporal proximity weighting.  Two notes written close in time are mor`, `score()`, `recency.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (4 nodes): `phrase.py`, `Phrase overlap similarity: weighted Jaccard over detected multi-word phrases.`, `score()`, `phrase.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (4 nodes): `integration.py`, `Integration score: how well a new note attaches to the existing topic graph.`, `score()`, `integration.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (4 nodes): `fragmentation.py`, `Fragmentation: topic spans many notes but internal connectivity is weak.`, `score()`, `fragmentation.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (4 nodes): `popover.tsx`, `Popover()`, `PopoverTrigger()`, `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (4 nodes): `loadMore()`, `selectTag()`, `blog-list.tsx`, `blog-list.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (4 nodes): `note-view.tsx`, `buildOutlinePlaceholder()`, `buildTldrPlaceholder()`, `note-view.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (4 nodes): `scroll-area.tsx`, `ScrollArea()`, `ScrollBar()`, `scroll-area.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (3 nodes): `Entrypoint: python analyze_space.py --space-id 123`, `analyze_space.py`, `analyze_space.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (3 nodes): `index.ts`, `json()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (3 nodes): `layout.tsx`, `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (3 nodes): `loading.tsx`, `Loading()`, `loading.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (3 nodes): `page.tsx`, `PricingHome()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (3 nodes): `page.tsx`, `SignInPage()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (3 nodes): `createClient()`, `client.ts`, `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (3 nodes): `hover-card.tsx`, `HoverCard()`, `hover-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (3 nodes): `gradient-text.tsx`, `GradientText()`, `gradient-text.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (3 nodes): `label.tsx`, `Label()`, `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (3 nodes): `tooltip.tsx`, `TooltipContent()`, `tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (3 nodes): `AnimatedGradientText()`, `animated-gradient-text.tsx`, `animated-gradient-text.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `Badge()`, `badge.tsx`, `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (3 nodes): `separator.tsx`, `Separator()`, `separator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (3 nodes): `cn()`, `button.tsx`, `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (3 nodes): `Checkbox()`, `checkbox.tsx`, `checkbox.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `spinner.tsx`, `Spinner()`, `spinner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (3 nodes): `textarea.tsx`, `cn()`, `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (3 nodes): `input.tsx`, `Input()`, `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (3 nodes): `DialogEnhanced()`, `dialog-enhanced.tsx`, `dialog-enhanced.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (3 nodes): `smtp-message.tsx`, `SmtpMessage()`, `smtp-message.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (3 nodes): `AuthLayout()`, `auth-layout.tsx`, `auth-layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (3 nodes): `footer.tsx`, `Footer()`, `footer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (3 nodes): `header.tsx`, `Header()`, `header.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 77`** (3 nodes): `FeaturedPost()`, `blog-featured-post.tsx`, `blog-featured-post.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 78`** (3 nodes): `cn()`, `countdown.tsx`, `countdown.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (3 nodes): `unrenderable-content.tsx`, `UnrenderableContent()`, `unrenderable-content.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (3 nodes): `pricing-faq.tsx`, `PricingFaq()`, `pricing-faq.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (3 nodes): `use-debounce.ts`, `useDebounce()`, `use-debounce.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 82`** (3 nodes): `use-media-query.ts`, `useMediaQuery()`, `use-media-query.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 83`** (3 nodes): `utils.ts`, `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (2 nodes): `Note view modal conventions`, `Notes view feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (2 nodes): `Nexus conventions (d3 force graph)`, `Nexus feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (2 nodes): `Dot conventions (mock 50s wait)`, `Dot (agent) feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 87`** (2 nodes): `Dashboard card shell (1600x1000, 200px sidebar)`, `Core shell feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (2 nodes): `Spaces dialog conventions`, `Spaces feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (2 nodes): `Cross-cutting web conventions (toasts, ErrorBoundary, auth redirects)`, `Cross-cutting feature table`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 174`** (1 nodes): `Princeton University logo`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Confusion Detection` to `Score Calibration & Diagnostics`, `Web Auth Actions`, `Engine Config & Ingest Normalize`, `Concept Canonicalization (Phrases/Lemma)`, `Supabase Postgres Store`, `Co-occurrence & Lexical Similarity`, `Centrality & Bridge Notes`, `Rankings & Roles (Foundational/Gaps)`, `Topic Identity Across Runs`, `Stage Budgets / Fail-Soft`, `kNN Graph Builder`?**
  _High betweenness centrality (0.098) - this node is a cross-community bridge._
- **Why does `createClient()` connect `Web Auth Actions` to `Confusion Detection`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `run_analysis()` connect `Score Calibration & Diagnostics` to `Engine Config & Ingest Normalize`, `Confusion Detection`, `Eval Fixtures & Synthetic Notes`, `Concept Canonicalization (Phrases/Lemma)`, `Supabase Postgres Store`, `Co-occurrence & Lexical Similarity`, `Centrality & Bridge Notes`, `Rankings & Roles (Foundational/Gaps)`, `Topic Identity Across Runs`, `Topic Rollup Compression`, `kNN Graph Builder`, `Structural vs Interpretive Confidence`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Are the 41 inferred relationships involving `run_analysis()` (e.g. with `test_production_pipeline()` and `test_profile_classification_directs_to_expected_kind()`) actually correct?**
  _`run_analysis()` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 41 inferred relationships involving `NoteRecord` (e.g. with `Production-layer extensive tests.  Exercises calibration, gates, profile adaptat` and `Each synthetic space must land in the expected profile kind (with some slack).`) actually correct?**
  _`NoteRecord` has 41 INFERRED edges - model-reasoned connections that need verification._
- **Are the 40 inferred relationships involving `GET()` (e.g. with `_print_relations()` and `test_hard_gates_suppress_weak_signals()`) actually correct?**
  _`GET()` has 40 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `str` (e.g. with `test_hard_gates_suppress_weak_signals()` and `_mk()`) actually correct?**
  _`str` has 20 INFERRED edges - model-reasoned connections that need verification._