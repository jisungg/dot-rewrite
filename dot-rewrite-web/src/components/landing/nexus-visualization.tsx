"use client";

import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  FileText,
  HelpCircle,
  Lightbulb,
  MessageCircle,
  Minus,
  Plus,
  X,
  Zap,
} from "lucide-react";

type NodeType = "note" | "concept" | "question" | "ai_chat" | "suggestion";
type LinkType = "references" | "answers" | "suggests" | "contains" | "relates";

interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  subtopic?: string;
}

interface GraphLink {
  source: string;
  target: string;
  type: LinkType;
}

const nodes: GraphNode[] = [
  { id: "calculus_course", label: "Calculus II", type: "note", description: "Spring 2025 Calculus II course with Professor Johnson", subtopic: "course" },
  { id: "lecture_limits", label: "Lecture: Limits", type: "note", description: "Notes from Jan 15 lecture on limits and continuity", subtopic: "limits" },
  { id: "lecture_derivatives", label: "Lecture: Derivatives", type: "note", description: "Notes from Jan 22 lecture on differentiation techniques", subtopic: "derivatives" },
  { id: "lecture_integrals", label: "Lecture: Integration", type: "note", description: "Notes from Feb 5 lecture on integration methods", subtopic: "integrals" },
  { id: "lecture_series", label: "Lecture: Series", type: "note", description: "Notes from Mar 10 lecture on infinite series", subtopic: "series" },

  { id: "epsilon_delta", label: "ε-δ Definition", type: "concept", description: "Formal definition of limits using epsilon-delta notation", subtopic: "limits" },
  { id: "continuity", label: "Continuity", type: "concept", description: "Properties of continuous functions and types of discontinuities", subtopic: "limits" },
  { id: "power_rule", label: "Power Rule", type: "concept", description: "Rule for differentiating functions of the form x^n", subtopic: "derivatives" },
  { id: "chain_rule", label: "Chain Rule", type: "concept", description: "Formula for computing the derivative of a composite function", subtopic: "derivatives" },
  { id: "product_rule", label: "Product Rule", type: "concept", description: "Rule for differentiating the product of two functions", subtopic: "derivatives" },
  { id: "quotient_rule", label: "Quotient Rule", type: "concept", description: "Rule for differentiating the quotient of two functions", subtopic: "derivatives" },
  { id: "substitution", label: "U-Substitution", type: "concept", description: "Method for integrating composite functions", subtopic: "integrals" },
  { id: "integration_by_parts", label: "Integration by Parts", type: "concept", description: "Technique for integrating products of functions", subtopic: "integrals" },
  { id: "partial_fractions", label: "Partial Fractions", type: "concept", description: "Method for integrating rational functions", subtopic: "integrals" },
  { id: "convergence_tests", label: "Convergence Tests", type: "concept", description: "Methods to determine if a series converges", subtopic: "series" },
  { id: "power_series", label: "Power Series", type: "concept", description: "Series representation of functions using powers of x", subtopic: "series" },
  { id: "taylor_series", label: "Taylor Series", type: "concept", description: "Representation of a function as an infinite sum of terms", subtopic: "series" },

  { id: "limit_question", label: "Limit at Discontinuity?", type: "question", description: "How do I find the limit of f(x) = (x²-1)/(x-1) as x approaches 1?", subtopic: "limits" },
  { id: "derivative_question", label: "Derivative of e^x·sin(x)?", type: "question", description: "How do I find the derivative of e^x·sin(x)?", subtopic: "derivatives" },
  { id: "integral_question", label: "Integral of sec³(x)?", type: "question", description: "What's the best approach to integrate sec³(x)?", subtopic: "integrals" },
  { id: "series_question", label: "Testing Convergence?", type: "question", description: "How do I determine which convergence test to use for Σ n/(n²+1)?", subtopic: "series" },

  { id: "limit_explanation", label: "Limit Explanation", type: "ai_chat", description: "Step-by-step solution for the limit of (x²-1)/(x-1) using factorization", subtopic: "limits" },
  { id: "product_rule_explanation", label: "Product Rule Walkthrough", type: "ai_chat", description: "Detailed explanation of how to apply the product and chain rules to e^x·sin(x)", subtopic: "derivatives" },
  { id: "integration_explanation", label: "Integration Technique", type: "ai_chat", description: "Explanation of how to use substitution and trigonometric identities for sec³(x)", subtopic: "integrals" },
  { id: "series_explanation", label: "Series Convergence Analysis", type: "ai_chat", description: "Analysis of which tests apply to the given series and why the ratio test works best", subtopic: "series" },

  { id: "limit_practice", label: "Limit Practice Problems", type: "suggestion", description: "Similar limit problems to reinforce understanding of discontinuities", subtopic: "limits" },
  { id: "derivative_practice", label: "Derivative Practice", type: "suggestion", description: "Similar derivative problems involving product and chain rules", subtopic: "derivatives" },
  { id: "integral_practice", label: "Integration Practice", type: "suggestion", description: "Additional practice problems for trigonometric integrals", subtopic: "integrals" },
  { id: "series_practice", label: "Series Practice", type: "suggestion", description: "Practice problems for applying different convergence tests", subtopic: "series" },
];

const links: GraphLink[] = [
  { source: "calculus_course", target: "lecture_limits", type: "contains" },
  { source: "calculus_course", target: "lecture_derivatives", type: "contains" },
  { source: "calculus_course", target: "lecture_integrals", type: "contains" },
  { source: "calculus_course", target: "lecture_series", type: "contains" },

  { source: "lecture_limits", target: "epsilon_delta", type: "contains" },
  { source: "lecture_limits", target: "continuity", type: "contains" },
  { source: "epsilon_delta", target: "continuity", type: "relates" },
  { source: "continuity", target: "limit_question", type: "relates" },
  { source: "limit_question", target: "limit_explanation", type: "answers" },
  { source: "limit_explanation", target: "limit_practice", type: "suggests" },

  { source: "lecture_derivatives", target: "power_rule", type: "contains" },
  { source: "lecture_derivatives", target: "chain_rule", type: "contains" },
  { source: "lecture_derivatives", target: "product_rule", type: "contains" },
  { source: "lecture_derivatives", target: "quotient_rule", type: "contains" },
  { source: "product_rule", target: "derivative_question", type: "relates" },
  { source: "chain_rule", target: "derivative_question", type: "relates" },
  { source: "derivative_question", target: "product_rule_explanation", type: "answers" },
  { source: "product_rule_explanation", target: "derivative_practice", type: "suggests" },
  { source: "power_rule", target: "chain_rule", type: "relates" },
  { source: "product_rule", target: "quotient_rule", type: "relates" },

  { source: "lecture_integrals", target: "substitution", type: "contains" },
  { source: "lecture_integrals", target: "integration_by_parts", type: "contains" },
  { source: "lecture_integrals", target: "partial_fractions", type: "contains" },
  { source: "substitution", target: "integration_by_parts", type: "relates" },
  { source: "integration_by_parts", target: "partial_fractions", type: "relates" },
  { source: "integral_question", target: "integration_explanation", type: "answers" },
  { source: "integration_explanation", target: "integral_practice", type: "suggests" },
  { source: "substitution", target: "integral_question", type: "relates" },

  { source: "lecture_series", target: "convergence_tests", type: "contains" },
  { source: "lecture_series", target: "power_series", type: "contains" },
  { source: "lecture_series", target: "taylor_series", type: "contains" },
  { source: "convergence_tests", target: "series_question", type: "relates" },
  { source: "series_question", target: "series_explanation", type: "answers" },
  { source: "series_explanation", target: "series_practice", type: "suggests" },
  { source: "power_series", target: "taylor_series", type: "relates" },
  { source: "convergence_tests", target: "power_series", type: "relates" },

  { source: "continuity", target: "power_rule", type: "relates" },
  { source: "power_rule", target: "substitution", type: "relates" },
  { source: "integration_by_parts", target: "taylor_series", type: "relates" },
  { source: "chain_rule", target: "substitution", type: "relates" },
];

const nodeColor: Record<NodeType, string> = {
  note: "#64748b",
  concept: "#3b82f6",
  question: "#f97316",
  ai_chat: "#8b5cf6",
  suggestion: "#10b981",
};

const nodeIcon = (type: NodeType, size = 12) => {
  switch (type) {
    case "note":
      return <FileText size={size} />;
    case "concept":
      return <Zap size={size} />;
    case "question":
      return <HelpCircle size={size} />;
    case "ai_chat":
      return <MessageCircle size={size} />;
    case "suggestion":
      return <Lightbulb size={size} />;
  }
};

const linkColor = (type: LinkType, highlighted: boolean) => {
  if (!highlighted) return "rgba(203, 213, 225, 0.4)";
  switch (type) {
    case "contains":
      return "rgba(100, 116, 139, 0.8)";
    case "relates":
      return "rgba(59, 130, 246, 0.8)";
    case "answers":
      return "rgba(139, 92, 246, 0.8)";
    case "suggests":
      return "rgba(16, 185, 129, 0.8)";
    case "references":
      return "rgba(249, 115, 22, 0.8)";
  }
};

export default function NexusVisualization() {
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [initialized, setInitialized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0 });
  const viewOffsetRef = useRef({ x: 0, y: 0 });
  const nodePositions = useRef<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    if (!containerRef.current) return;
    const update = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    const place = (
      group: GraphNode[],
      baseAngle: number,
    ) => {
      group.forEach((node, i) => {
        const angle = baseAngle + (i / group.length) * Math.PI * 0.5;
        const distance = node.type === "note" ? 120 : 180;
        nodePositions.current[node.id] = {
          x: centerX + Math.cos(angle) * distance,
          y: centerY + Math.sin(angle) * distance,
        };
      });
    };

    nodes
      .filter((n) => n.subtopic === "course")
      .forEach((n) => {
        nodePositions.current[n.id] = { x: centerX, y: centerY };
      });

    place(nodes.filter((n) => n.subtopic === "limits"), Math.PI * 0.75);
    place(nodes.filter((n) => n.subtopic === "derivatives"), Math.PI * 0.25);
    place(nodes.filter((n) => n.subtopic === "integrals"), Math.PI * 1.75);
    place(nodes.filter((n) => n.subtopic === "series"), Math.PI * 1.25);

    setInitialized(true);
  }, [dimensions]);

  const getConnectedNodes = (nodeId: string) =>
    links
      .filter((l) => l.source === nodeId || l.target === nodeId)
      .map((l) => (l.source === nodeId ? l.target : l.source));

  const getConnectedLinks = (nodeId: string) =>
    links.filter((l) => l.source === nodeId || l.target === nodeId);

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    viewOffsetRef.current = { x: viewOffset.x, y: viewOffset.y };
  };

  const onMouseMove = (e: ReactMouseEvent) => {
    if (!dragging) return;
    setDragOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const onMouseUp = () => {
    if (!dragging) return;
    setDragging(false);
    setViewOffset({
      x: viewOffsetRef.current.x + dragOffset.x,
      y: viewOffsetRef.current.y + dragOffset.y,
    });
    setDragOffset({ x: 0, y: 0 });
  };

  const handleZoom = (direction: "in" | "out") => {
    setZoom((prev) => {
      if (direction === "in" && prev < 1.5) return prev + 0.1;
      if (direction === "out" && prev > 0.5) return prev - 0.1;
      return prev;
    });
  };

  const resetView = () => {
    setZoom(1);
    setViewOffset({ x: 0, y: 0 });
    setActiveNode(null);
  };

  const transform = `scale(${zoom}) translate(${viewOffset.x + dragOffset.x}px, ${viewOffset.y + dragOffset.y}px)`;

  return (
    <div className="py-12">
      <div className="container mx-auto">
        <div className="flex flex-col items-center">
          <div className="w-full max-w-4xl mx-auto">
            <div
              ref={containerRef}
              className="relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden h-[500px] shadow-sm"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px]" />

              {initialized && (
                <>
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform }}
                  >
                    {links.map((link, i) => {
                      const sourcePos = nodePositions.current[link.source];
                      const targetPos = nodePositions.current[link.target];
                      if (!sourcePos || !targetPos) return null;

                      const highlighted =
                        activeNode === link.source ||
                        activeNode === link.target ||
                        (!!hoveredNode &&
                          (hoveredNode === link.source ||
                            hoveredNode === link.target));

                      const dx = targetPos.x - sourcePos.x;
                      const dy = targetPos.y - sourcePos.y;
                      const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
                      const path = `M${sourcePos.x},${sourcePos.y} A${dr},${dr} 0 0,1 ${targetPos.x},${targetPos.y}`;

                      return (
                        <path
                          key={i}
                          d={path}
                          fill="none"
                          stroke={linkColor(link.type, highlighted)}
                          strokeWidth={highlighted ? 1.5 : 1}
                          strokeDasharray={
                            link.type === "suggests" ? "3 2" : undefined
                          }
                        />
                      );
                    })}
                  </svg>

                  <div className="absolute inset-0" style={{ transform }}>
                    {nodes.map((node) => {
                      const position = nodePositions.current[node.id] ?? {
                        x: 0,
                        y: 0,
                      };
                      const isActive = activeNode === node.id;
                      const isHovered = hoveredNode === node.id;
                      const connected = activeNode
                        ? getConnectedNodes(activeNode)
                        : [];
                      const isConnected = connected.includes(node.id);
                      const color = nodeColor[node.type];
                      const size = node.type === "note" ? 36 : 28;

                      return (
                        <motion.div
                          key={node.id}
                          className={`absolute rounded-full flex items-center justify-center cursor-pointer ${
                            isActive ? "ring-2 ring-offset-2" : ""
                          }`}
                          style={{
                            left: position.x,
                            top: position.y,
                            width: size,
                            height: size,
                            backgroundColor:
                              isActive || isHovered ? color : "white",
                            border: `1.5px solid ${color}`,
                            color: isActive || isHovered ? "white" : color,
                            transform: "translate(-50%, -50%)",
                            opacity:
                              !activeNode || isActive || isConnected ? 1 : 0.3,
                            zIndex: isActive ? 20 : 10,
                            boxShadow:
                              isActive || isHovered
                                ? `0 0 0 4px rgba(255,255,255,0.8), 0 0 0 5px ${color}40`
                                : "none",
                            transition: "all 0.2s ease",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveNode(isActive ? null : node.id);
                          }}
                          onMouseEnter={() => setHoveredNode(node.id)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {nodeIcon(node.type)}
                        </motion.div>
                      );
                    })}
                  </div>

                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ transform }}
                  >
                    {nodes.map((node) => {
                      const position = nodePositions.current[node.id] ?? {
                        x: 0,
                        y: 0,
                      };
                      const isActive = activeNode === node.id;
                      const isHovered = hoveredNode === node.id;
                      const connected = activeNode
                        ? getConnectedNodes(activeNode)
                        : [];
                      const isConnected = connected.includes(node.id);
                      const size = node.type === "note" ? 36 : 28;

                      return (
                        <div
                          key={`label-${node.id}`}
                          className="absolute text-center"
                          style={{
                            left: position.x,
                            top: position.y + size / 2 + 6,
                            transform: "translate(-50%, 0)",
                            opacity:
                              !activeNode || isActive || isConnected ? 1 : 0.3,
                            zIndex: 5,
                          }}
                        >
                          <div
                            className={`text-xs font-medium px-1 py-0.5 rounded-sm max-w-[120px] truncate ${
                              isActive || isHovered
                                ? "bg-white/90 shadow-sm"
                                : ""
                            }`}
                          >
                            {node.label}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <AnimatePresence>
                    {activeNode && (
                      <motion.div
                        className="absolute bottom-4 left-4 right-4 bg-white p-3 rounded-md shadow-sm border border-slate-200"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {(() => {
                          const node = nodes.find((n) => n.id === activeNode);
                          if (!node) return null;

                          const color = nodeColor[node.type];
                          const connectedLinks = getConnectedLinks(activeNode);

                          return (
                            <>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: color }}
                                  >
                                    {nodeIcon(node.type, 10)}
                                  </div>
                                  <h3 className="text-sm font-medium text-slate-900">
                                    {node.label}
                                  </h3>
                                </div>
                                <button
                                  type="button"
                                  className="text-slate-400 hover:text-slate-600"
                                  onClick={() => setActiveNode(null)}
                                >
                                  <X size={14} />
                                </button>
                              </div>

                              <p className="text-xs text-slate-600 mb-2">
                                {node.description}
                              </p>

                              {connectedLinks.length > 0 && (
                                <div>
                                  <h4 className="text-xs font-medium text-slate-700 mb-1">
                                    Connected to:
                                  </h4>
                                  <div className="flex flex-wrap gap-1">
                                    {connectedLinks.map((link, idx) => {
                                      const isSource =
                                        link.source === activeNode;
                                      const connectedId = isSource
                                        ? link.target
                                        : link.source;
                                      const connectedNode = nodes.find(
                                        (n) => n.id === connectedId,
                                      );
                                      if (!connectedNode) return null;

                                      const connectedColor =
                                        nodeColor[connectedNode.type];

                                      return (
                                        <div
                                          key={idx}
                                          className="text-xs px-1.5 py-0.5 rounded border"
                                          style={{
                                            borderColor: `${connectedColor}40`,
                                            color: connectedColor,
                                          }}
                                        >
                                          {connectedNode.label}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="absolute top-3 right-3 flex flex-col gap-1">
                    <button
                      type="button"
                      className="w-6 h-6 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      onClick={() => handleZoom("in")}
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="w-6 h-6 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      onClick={() => handleZoom("out")}
                    >
                      <Minus size={14} />
                    </button>
                    <button
                      type="button"
                      className="w-6 h-6 bg-white rounded-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 mt-1"
                      onClick={resetView}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M3 12C3 16.9706 7.02944 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                        <path
                          d="M9 3L3 3L3 9"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="absolute top-3 left-3 bg-white/90 p-2 rounded-md border border-slate-200 text-xs">
                    <div className="grid grid-cols-1 gap-y-1">
                      {(
                        [
                          { type: "note", label: "Notes" },
                          { type: "concept", label: "Concepts" },
                          { type: "question", label: "Questions" },
                          { type: "ai_chat", label: "AI Chats" },
                          { type: "suggestion", label: "Suggestions" },
                        ] as const
                      ).map((item) => (
                        <div
                          key={item.type}
                          className="flex items-center gap-1.5"
                        >
                          <div
                            className="w-3 h-3 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: nodeColor[item.type] }}
                          >
                            {nodeIcon(item.type, 10)}
                          </div>
                          <span className="text-slate-600">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-4 text-center max-w-xl mx-auto">
              <p className="text-gray-500 text-sm mb-4">
                Powered by LLM parsing and knowledge graphs, Nexus visualizes
                the connections between your notes, concepts, and AI
                interactions. Click on nodes to explore relationships and
                discover insights.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
