"""
Script to generate high-quality flowcharts using matplotlib and insert them
into the research paper PDF using PyMuPDF (fitz).
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe
import numpy as np
import fitz  # PyMuPDF
import os
import tempfile
from pathlib import Path

# ─────────────────────────────────────────────────────
#  STYLE CONSTANTS
# ─────────────────────────────────────────────────────
COLORS = {
    "header":    "#1A237E",   # dark navy
    "box_blue":  "#1565C0",
    "box_green": "#2E7D32",
    "box_teal":  "#00695C",
    "box_purple":"#4A148C",
    "box_orange":"#E65100",
    "box_red":   "#C62828",
    "box_gray":  "#37474F",
    "bg_light":  "#F3F6FB",
    "arrow":     "#546E7A",
    "text_white":"#FFFFFF",
    "text_dark": "#212121",
    "accent":    "#FF6F00",
}

FIGSIZE_WIDE  = (14, 8)
FIGSIZE_TALL  = (10, 14)
FIGSIZE_SQUARE= (12, 10)
DPI           = 180

def save_fig(fig, path):
    fig.savefig(path, dpi=DPI, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print(f"  Saved: {path}")


# ══════════════════════════════════════════════════════
#  FLOWCHART 1 – Full System Architecture (Node-Box)
# ══════════════════════════════════════════════════════
def make_fc1_system_architecture(out_path):
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis('off')
    fig.patch.set_facecolor('#F8F9FF')

    # Title
    ax.text(7, 8.6, "Offline AI Digital Brain — System Architecture",
            ha='center', va='center', fontsize=16, fontweight='bold',
            color=COLORS["header"])

    def box(ax, x, y, w, h, label, sublabel="", color="#1565C0", fontsize=10):
        patch = FancyBboxPatch((x - w/2, y - h/2), w, h,
                               boxstyle="round,pad=0.08",
                               facecolor=color, edgecolor='white',
                               linewidth=1.5, zorder=3)
        ax.add_patch(patch)
        ax.text(x, y + (0.12 if sublabel else 0), label,
                ha='center', va='center', fontsize=fontsize,
                color='white', fontweight='bold', zorder=4)
        if sublabel:
            ax.text(x, y - 0.22, sublabel,
                    ha='center', va='center', fontsize=7.5,
                    color='#DDEEFF', zorder=4)

    def arrow(ax, x1, y1, x2, y2, label="", color="#546E7A"):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color,
                                   lw=1.8, mutation_scale=18),
                    zorder=2)
        if label:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx+0.08, my, label, fontsize=7, color=color,
                    ha='left', va='center', style='italic', zorder=5)

    # ── User layer ──
    box(ax, 2,  7.8, 2.2, 0.65, "👤 User", color=COLORS["box_orange"])

    # ── Frontend layer ──
    box(ax, 7,  7.8, 3.8, 0.65, "🎨 React 18 Frontend (Vite + Tailwind)",
        "localhost:5173", color=COLORS["box_blue"])

    # ── Browser Extension ──
    box(ax, 2,  6.4, 2.2, 0.65, "🔌 Browser\nExtension", color=COLORS["box_teal"])

    # ── Backend layer ──
    box(ax, 7, 6.4, 3.8, 0.65, "⚙️ FastAPI Backend",
        "localhost:8000  |  Agent Router  |  RAG Engine  |  VLM OCR",
        color=COLORS["box_purple"])

    # ── Sub-services ──
    box(ax, 3,  4.6, 2.2, 0.65, "🤖 Ollama\nModel Runner",
        "localhost:11434", color=COLORS["box_gray"])
    box(ax, 7,  4.6, 2.2, 0.65, "📚 ChromaDB\nVector Store",
        "Semantic Search", color=COLORS["box_green"])
    box(ax, 11, 4.6, 2.2, 0.65, "💾 SQLite DB\n+ Local Files",
        "Chats / Metadata", color=COLORS["box_gray"])

    # ── Models ──
    box(ax, 1.4, 2.8, 1.5, 0.6, "TinyLlama\n1.1B", color="#455A64")
    box(ax, 3.2, 2.8, 1.5, 0.6, "Mistral\n7B",     color="#455A64")
    box(ax, 5.0, 2.8, 1.5, 0.6, "Llama 3\n8B",     color="#455A64")
    box(ax, 6.8, 2.8, 1.5, 0.6, "LLava\n7B",       color=COLORS["box_teal"])
    box(ax, 8.6, 2.8, 1.8, 0.6, "nomic-embed-\ntext", color=COLORS["box_teal"])

    # ── Online services (optional) ──
    box(ax, 11, 7.8, 2.2, 0.65, "🌐 Internet\n(Optional)", color=COLORS["box_red"])
    box(ax, 11, 6.4, 2.2, 0.65, "☁️ Groq/OpenAI\nCloud API",  color=COLORS["box_red"])

    # ── Arrows ──
    arrow(ax, 3.1, 7.8, 5.1, 7.8, "interact")
    arrow(ax, 2,   7.45, 2,   6.72, "browser")
    arrow(ax, 7,   7.45, 7,   6.72, "HTTP")
    arrow(ax, 3.1, 6.4, 5.1, 6.4, "HTTP")
    # backend → subsystems
    arrow(ax, 5.5, 6.07, 3.8, 4.92, "model calls")
    arrow(ax, 7.0, 6.07, 7.0, 4.92, "embed/search")
    arrow(ax, 8.5, 6.07, 10.2, 4.92, "persist")
    # ollama → models
    arrow(ax, 2.0, 4.28, 1.4,  3.1, "")
    arrow(ax, 2.5, 4.28, 3.2,  3.1, "")
    arrow(ax, 3.2, 4.28, 5.0,  3.1, "")
    arrow(ax, 3.8, 4.28, 6.8,  3.1, "")
    arrow(ax, 4.0, 4.28, 8.3,  3.1, "")
    # backend → online (dashed look via annotation)
    arrow(ax, 8.9, 6.4, 9.9, 6.4, "optional", color="#C62828")
    arrow(ax, 11,  7.12, 11, 6.72, "", color="#C62828")

    # Legend
    for i, (label, color) in enumerate([
        ("Core Local Service", COLORS["box_blue"]),
        ("AI Models (Ollama)", "#455A64"),
        ("Optional Cloud", COLORS["box_red"]),
        ("User / Browser", COLORS["box_orange"]),
    ]):
        lx = 0.4 + i * 3.5
        patch = mpatches.Patch(color=color, label=label)
        ax.add_patch(FancyBboxPatch((lx, 0.3), 0.35, 0.28,
                                    boxstyle="round,pad=0.04",
                                    facecolor=color, edgecolor='none'))
        ax.text(lx + 0.45, 0.44, label, va='center', fontsize=8, color=COLORS["text_dark"])

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 2 – VLM OCR Pipeline
# ══════════════════════════════════════════════════════
def make_fc2_vlm_ocr_pipeline(out_path):
    fig, ax = plt.subplots(figsize=(13, 7))
    ax.set_xlim(0, 13)
    ax.set_ylim(0, 7)
    ax.axis('off')
    fig.patch.set_facecolor('#F8FFF8')

    ax.text(6.5, 6.65, "VLM-Based OCR Pipeline for Scanned Document Ingestion",
            ha='center', va='center', fontsize=15, fontweight='bold',
            color=COLORS["header"])

    steps = [
        (1.2,  3.5, "📤 Upload\nPDF", COLORS["box_orange"]),
        (3.2,  3.5, "🖼️ Render Pages\nto PNG Images\n(pdf2image/Poppler\n≥300 DPI)", COLORS["box_blue"]),
        (5.5,  3.5, "🤖 LLava VLM\nInference\n(per page)", COLORS["box_purple"]),
        (7.8,  3.5, "📝 Text\nAggregation\n& Cleaning", COLORS["box_teal"]),
        (10.0, 3.5, "✂️ Chunking\n(512 tokens,\n50 overlap)", COLORS["box_green"]),
        (12.0, 3.5, "📚 ChromaDB\nIndexing", COLORS["box_gray"]),
    ]

    for x, y, label, color in steps:
        patch = FancyBboxPatch((x - 0.85, y - 0.9), 1.7, 1.8,
                               boxstyle="round,pad=0.1",
                               facecolor=color, edgecolor='white', linewidth=1.8, zorder=3)
        ax.add_patch(patch)
        ax.text(x, y, label, ha='center', va='center', fontsize=8.5,
                color='white', fontweight='bold', zorder=4, linespacing=1.4)

    # Arrows between steps
    for i in range(len(steps) - 1):
        x1 = steps[i][0] + 0.85
        x2 = steps[i+1][0] - 0.85
        y  = steps[i][1]
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="-|>", color=COLORS["arrow"],
                                   lw=2, mutation_scale=20), zorder=2)

    # Sub-labels below arrows
    sublabels = ["Poppler", "Ollama API", "concat/strip", "LangChain", "embed+store"]
    for i, lbl in enumerate(sublabels):
        mx = (steps[i][0] + steps[i+1][0]) / 2
        ax.text(mx, 3.5 - 1.25, lbl, ha='center', va='center', fontsize=7.5,
                color=COLORS["arrow"], style='italic')

    # Decision diamond for standard vs scanned
    diamond_x, diamond_y = 1.2, 5.3
    d = 0.55
    diamond = plt.Polygon(
        [[diamond_x, diamond_y + d],
         [diamond_x + d*1.4, diamond_y],
         [diamond_x, diamond_y - d],
         [diamond_x - d*1.4, diamond_y]],
        facecolor='#FFF176', edgecolor=COLORS["box_orange"], linewidth=2, zorder=3)
    ax.add_patch(diamond)
    ax.text(diamond_x, diamond_y, "PDF\nType?", ha='center', va='center',
            fontsize=9, fontweight='bold', color=COLORS["text_dark"], zorder=4)

    # Standard PDF branch
    patch2 = FancyBboxPatch((2.4, 4.75), 1.8, 0.9,
                             boxstyle="round,pad=0.08",
                             facecolor=COLORS["box_green"], edgecolor='white',
                             linewidth=1.5, zorder=3)
    ax.add_patch(patch2)
    ax.text(3.3, 5.2, "📄 Standard PDF\nNative Text Extract\n(PyMuPDF)", ha='center', va='center',
            fontsize=8, color='white', fontweight='bold', zorder=4)

    # Arrows from diamond
    ax.annotate("", xy=(1.2, 4.4), xytext=(1.2, 4.75),
                arrowprops=dict(arrowstyle="-|>", color=COLORS["box_red"], lw=2,
                                mutation_scale=18), zorder=2)
    ax.text(1.35, 4.58, "Scanned/\nHandwritten", ha='left', va='center',
            fontsize=7.5, color=COLORS["box_red"], fontweight='bold')

    ax.annotate("", xy=(2.4, 5.2), xytext=(1.2+0.77, 5.2),
                arrowprops=dict(arrowstyle="-|>", color=COLORS["box_green"], lw=2,
                                mutation_scale=18), zorder=2)
    ax.text(1.9, 5.45, "Standard", ha='center', va='center',
            fontsize=7.5, color=COLORS["box_green"], fontweight='bold')

    # Standard PDF arrow straight to aggregation
    ax.annotate("", xy=(7.8, 4.4), xytext=(4.2, 5.2),
                arrowprops=dict(arrowstyle="-|>", color=COLORS["box_green"], lw=1.5,
                                connectionstyle="arc3,rad=-0.25",
                                mutation_scale=15), zorder=2)
    ax.text(6.0, 5.5, "direct text", ha='center', va='center',
            fontsize=7.5, color=COLORS["box_green"], style='italic')

    # Note box
    note = ("Note: LLava inference runs per-page in parallel.\n"
            "300 DPI rendering improves accuracy by ~15%.")
    ax.text(6.5, 0.5, note, ha='center', va='center', fontsize=9,
            color=COLORS["header"], style='italic',
            bbox=dict(facecolor='#E3F2FD', edgecolor=COLORS["box_blue"],
                      boxstyle='round,pad=0.4', linewidth=1.2))

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 3 – Multi-Agent Routing & RAG Flow
# ══════════════════════════════════════════════════════
def make_fc3_multi_agent_rag(out_path):
    fig, ax = plt.subplots(figsize=(14, 10))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis('off')
    fig.patch.set_facecolor('#FFF8F0')

    ax.text(7, 9.65, "Multi-Agent Orchestration & RAG Query Flow",
            ha='center', va='center', fontsize=15, fontweight='bold',
            color=COLORS["header"])

    def box(x, y, w, h, label, color, fontsize=9.5):
        p = FancyBboxPatch((x - w/2, y - h/2), w, h,
                           boxstyle="round,pad=0.1",
                           facecolor=color, edgecolor='white',
                           linewidth=1.8, zorder=3)
        ax.add_patch(p)
        ax.text(x, y, label, ha='center', va='center',
                fontsize=fontsize, color='white', fontweight='bold',
                zorder=4, linespacing=1.4)

    def diamond(x, y, label, color=COLORS["box_orange"]):
        d = 0.5
        poly = plt.Polygon(
            [[x, y+d*1.1], [x+d*1.8, y], [x, y-d*1.1], [x-d*1.8, y]],
            facecolor='#FFF9C4', edgecolor=color, linewidth=2, zorder=3)
        ax.add_patch(poly)
        ax.text(x, y, label, ha='center', va='center',
                fontsize=8.5, fontweight='bold', color=COLORS["text_dark"], zorder=4)

    def arr(x1, y1, x2, y2, lbl="", rad=0, color=COLORS["arrow"]):
        style = f"arc3,rad={rad}" if rad else "arc3,rad=0"
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.8,
                                   connectionstyle=style, mutation_scale=18), zorder=2)
        if lbl:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx + 0.1, my, lbl, fontsize=7.5, color=color,
                    ha='left', va='center', style='italic', zorder=5)

    # User query
    box(7, 9.0, 2.4, 0.65, "❓ User Query", COLORS["box_orange"], fontsize=10)

    # Intent classifier
    box(7, 7.9, 3.2, 0.65, "🔍 Intent Classifier\n(TinyLlama)", COLORS["box_blue"])
    arr(7, 8.67, 7, 8.22)

    # Decision diamond
    diamond(7, 6.8, "Query\nCategory?")
    arr(7, 7.57, 7, 7.34)

    # Four agent branches
    agents = [
        (2.2,  5.4, "🔬 Research\nAgent", COLORS["box_purple"], "research"),
        (5.2,  5.4, "📊 Analysis\nAgent",  COLORS["box_blue"],   "analysis"),
        (8.8,  5.4, "🔗 Synthesis\nAgent", COLORS["box_teal"],   "synthesis"),
        (11.8, 5.4, "💬 General\nAgent",   COLORS["box_gray"],   "general"),
    ]

    for ax_x, ay, lbl, col, tag in agents:
        box(ax_x, ay, 2.2, 0.9, lbl, col, fontsize=8.5)
        arr(7, 6.25, ax_x, 5.85, tag, rad=(-0.25 if ax_x < 7 else 0.25))

    # RAG retrieval (under analysis & synthesis)
    box(7, 3.9, 3.8, 0.75, "📚 ChromaDB Semantic Search\n+ BM25 Hybrid Retrieval",
        COLORS["box_green"])
    arr(5.2,  4.95, 6.1,  4.28, "RAG lookup")
    arr(8.8,  4.95, 7.9,  4.28, "RAG lookup")

    # Scoring formula
    score_box = FancyBboxPatch((4.6, 2.8), 5.0, 0.8,
                               boxstyle="round,pad=0.12",
                               facecolor='#E8F5E9', edgecolor=COLORS["box_green"],
                               linewidth=1.5, zorder=3)
    ax.add_patch(score_box)
    ax.text(7.1, 3.2, "Hybrid Score:  F = 0.7 × Semantic + 0.3 × BM25   (threshold > 0.45)",
            ha='center', va='center', fontsize=9, color=COLORS["header"],
            fontstyle='italic', zorder=4)
    arr(7, 3.52, 7, 3.6)

    # Top-8 context selection
    box(7, 2.3, 3.2, 0.65, "✅ Top-8 Chunks → Context Window", COLORS["box_teal"])
    arr(7, 2.8, 7, 2.63)

    # LLM generation
    box(7, 1.4, 3.2, 0.65, "🤖 Ollama LLM\nGenerate Response", COLORS["box_purple"])
    arr(7, 1.97, 7, 1.73)

    # Output
    box(7, 0.55, 2.4, 0.65, "✅ Final Answer\nto User", COLORS["box_green"])
    arr(7, 1.07, 7, 0.88)

    # General agent bypass arrow
    arr(11.8, 4.95, 9.0, 0.55, "direct (no RAG)", rad=0.35, color=COLORS["box_gray"])

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 4 – RAG Document Ingestion Stages
# ══════════════════════════════════════════════════════
def make_fc4_rag_ingestion(out_path):
    fig, ax = plt.subplots(figsize=(14, 6.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 6.5)
    ax.axis('off')
    fig.patch.set_facecolor('#F0F4FF')

    ax.text(7, 6.15, "RAG Document Ingestion & Embedding Pipeline",
            ha='center', va='center', fontsize=15, fontweight='bold',
            color=COLORS["header"])

    pipeline = [
        (1.0,  3.4, "📤 Upload\n(PDF/TXT/DOCX)", COLORS["box_orange"], "FastAPI\nUploadFile"),
        (3.2,  3.4, "🔍 Text\nExtraction",        COLORS["box_blue"],   "PyMuPDF /\nVLM OCR"),
        (5.4,  3.4, "✂️ Chunking",                 COLORS["box_purple"], "512 tok\n50 overlap"),
        (7.6,  3.4, "🧮 Embedding",                COLORS["box_teal"],   "nomic-embed-\ntext (768-d)"),
        (9.8,  3.4, "📚 Indexing",                 COLORS["box_green"],  "ChromaDB\n(cosine)"),
        (12.0, 3.4, "✅ Ready for\nRAG Queries",    COLORS["box_gray"],   "Retrieve &\nGenerate"),
    ]

    for x, y, label, color, sublabel in pipeline:
        patch = FancyBboxPatch((x - 0.9, y - 0.88), 1.8, 1.76,
                               boxstyle="round,pad=0.1",
                               facecolor=color, edgecolor='white',
                               linewidth=2, zorder=3)
        ax.add_patch(patch)
        ax.text(x, y + 0.15, label, ha='center', va='center', fontsize=8.5,
                color='white', fontweight='bold', zorder=4, linespacing=1.35)
        ax.text(x, y - 0.52, sublabel, ha='center', va='center', fontsize=7,
                color='#DDEEFF', zorder=4, linespacing=1.2)

    for i in range(len(pipeline) - 1):
        x1 = pipeline[i][0] + 0.9
        x2 = pipeline[i+1][0] - 0.9
        ax.annotate("", xy=(x2, 3.4), xytext=(x1, 3.4),
                    arrowprops=dict(arrowstyle="-|>", color=COLORS["arrow"],
                                   lw=2.2, mutation_scale=22), zorder=2)

    # Step numbers
    for i, (x, y, *_) in enumerate(pipeline):
        circle = plt.Circle((x, y + 1.05), 0.22, color='white', zorder=5)
        ax.add_patch(circle)
        ax.text(x, y + 1.05, str(i+1), ha='center', va='center',
                fontsize=9, fontweight='bold', color=COLORS["header"], zorder=6)

    # Benchmark bar (latency)
    latencies = [0.01, 0.05, 0.005, 0.05, 0.02, 0]
    bar_labels = ["upload", "extract", "chunk", "embed", "index", ""]
    colors_bar = [COLORS["box_orange"], COLORS["box_blue"], COLORS["box_purple"],
                  COLORS["box_teal"], COLORS["box_green"], "none"]
    for i, (x, *_) in enumerate(pipeline[:-1]):
        bh = latencies[i] * 300
        ax.barh(1.4, bh, left=x - 0.85, height=0.4, color=colors_bar[i],
                alpha=0.7, zorder=2)
        ax.text(x - 0.85 + bh/2, 1.4, f"{latencies[i]*1000:.0f}ms",
                ha='center', va='center', fontsize=7.5, color='white', fontweight='bold', zorder=3)

    ax.text(0.2, 1.4, "Latency\n(typical):", ha='left', va='center',
            fontsize=7.5, color=COLORS["arrow"], fontstyle='italic')

    # Footer note
    ax.text(7, 0.35, "Hybrid retrieval: F = α × Semantic Score + (1−α) × BM25  |  α = 0.7  |  Threshold > 0.45",
            ha='center', va='center', fontsize=8.5, color=COLORS["header"],
            fontstyle='italic',
            bbox=dict(facecolor='white', edgecolor=COLORS["box_blue"],
                      boxstyle='round,pad=0.35', linewidth=1.2))

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 5 – Offline/Online/Hybrid Mode Decision
# ══════════════════════════════════════════════════════
def make_fc5_mode_decision(out_path):
    fig, ax = plt.subplots(figsize=(12, 9))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 9)
    ax.axis('off')
    fig.patch.set_facecolor('#FFFDE7')

    ax.text(6, 8.65, "Operational Mode Selection & Feature Availability",
            ha='center', va='center', fontsize=15, fontweight='bold',
            color=COLORS["header"])

    def box(x, y, w, h, label, color, fs=9):
        p = FancyBboxPatch((x - w/2, y - h/2), w, h,
                           boxstyle="round,pad=0.1",
                           facecolor=color, edgecolor='white',
                           linewidth=1.8, zorder=3)
        ax.add_patch(p)
        ax.text(x, y, label, ha='center', va='center',
                fontsize=fs, color='white', fontweight='bold',
                zorder=4, linespacing=1.35)

    def diamond(x, y, label):
        d = 0.55
        poly = plt.Polygon(
            [[x, y+d], [x+d*1.6, y], [x, y-d], [x-d*1.6, y]],
            facecolor='#FFF9C4', edgecolor=COLORS["box_orange"], linewidth=2, zorder=3)
        ax.add_patch(poly)
        ax.text(x, y, label, ha='center', va='center',
                fontsize=9, fontweight='bold', color=COLORS["text_dark"], zorder=4)

    def arr(x1, y1, x2, y2, lbl="", color=COLORS["arrow"], rad=0):
        style = f"arc3,rad={rad}"
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.8,
                                   connectionstyle=style, mutation_scale=18), zorder=2)
        if lbl:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx+0.12, my, lbl, fontsize=8, color=color,
                    ha='left', va='center', fontstyle='italic', zorder=5)

    # Start
    box(6, 8.15, 2.2, 0.65, "🚀 System Start", COLORS["box_blue"], 10)
    arr(6, 7.82, 6, 7.34)

    # Check Internet
    diamond(6, 6.9, "Internet\nAvailable?")
    arr(6, 7.6, 6, 7.45)

    # Three modes
    box(2.0, 5.5, 2.6, 0.75, "🔒 OFFLINE MODE\n15 Features", COLORS["box_green"], 9)
    box(6.0, 5.5, 2.6, 0.75, "🔄 HYBRID MODE\n21 Features",  COLORS["box_teal"],  9)
    box(10.0,5.5, 2.6, 0.75, "🌐 ONLINE MODE\n26 Features",  COLORS["box_blue"],  9)

    arr(6, 6.35, 2.9, 5.88, "No", color=COLORS["box_green"])
    arr(6, 6.35, 6,   5.88, "Partial/Prefer\nPrivacy", color=COLORS["box_teal"])
    arr(6, 6.35, 9.1, 5.88, "Full Online", color=COLORS["box_blue"])

    # Feature lists
    offline_features = ["Chat (Ollama)", "RAG Documents", "VLM OCR", "Web Creator",
                        "Writing Assistant", "Image Gen (local)", "Bg Remover",
                        "Translation", "Scholar AI", "+6 more"]
    hybrid_extra    = ["Hybrid Chat", "Enhanced Creator", "Smart Summary",
                       "Extended Agents"]
    online_extra    = ["YouTube Summary", "URL Summary", "Web Research",
                       "Model Download", "Cloud Translation", "+5 more"]

    for i, feat in enumerate(offline_features[:6]):
        ax.text(2.0, 4.65 - i * 0.32, f"• {feat}", ha='center', va='center',
                fontsize=7.5, color=COLORS["box_green"])

    for i, feat in enumerate(hybrid_extra):
        ax.text(6.0, 4.65 - i * 0.38, f"+ {feat}", ha='center', va='center',
                fontsize=7.5, color=COLORS["box_teal"])

    for i, feat in enumerate(online_extra[:5]):
        ax.text(10.0, 4.65 - i * 0.38, f"+ {feat}", ha='center', va='center',
                fontsize=7.5, color=COLORS["box_blue"])

    # Privacy ratings
    for xp, label, stars, color in [
        (2.0,  "Privacy:", "★★★★★", COLORS["box_green"]),
        (6.0,  "Privacy:", "★★★★☆", COLORS["box_teal"]),
        (10.0, "Privacy:", "★★☆☆☆", COLORS["box_blue"]),
    ]:
        ax.text(xp, 2.5, label, ha='center', va='center', fontsize=8,
                color=color, fontweight='bold')
        ax.text(xp, 2.18, stars, ha='center', va='center', fontsize=12, color=color)

    # Recommendation box
    ax.text(6, 0.9,
            "Recommendation: Start in Offline Mode for maximum privacy.\nEnable Hybrid for YouTube, URL, and translation features.",
            ha='center', va='center', fontsize=9, color=COLORS["header"],
            fontstyle='italic',
            bbox=dict(facecolor='white', edgecolor=COLORS["box_orange"],
                      boxstyle='round,pad=0.4', linewidth=1.5))

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 6 – Performance Benchmark Summary
# ══════════════════════════════════════════════════════
def make_fc6_performance_chart(out_path):
    fig, axes = plt.subplots(1, 3, figsize=(14, 6))
    fig.patch.set_facecolor('#F3F6FB')
    fig.suptitle("System Performance Benchmarks — Offline AI Digital Brain",
                 fontsize=14, fontweight='bold', color=COLORS["header"], y=0.98)

    # ── Subplot 1: Latency ──
    ax1 = axes[0]
    tasks = ["Chat\n(TinyLlama)", "Chat\n(Mistral 7B)", "Chat\n(Llama3 8B)",
             "OCR\n(LLava 7B)", "Translation\n(Mistral)", "Embedding\n(nomic)"]
    latencies = [0.9, 4.2, 7.8, 12.4, 3.1, 0.05]
    colors_l = [COLORS["box_green"], COLORS["box_teal"], COLORS["box_teal"],
                COLORS["box_purple"], COLORS["box_blue"], COLORS["box_green"]]
    bars = ax1.barh(tasks, latencies, color=colors_l, edgecolor='white', height=0.6)
    for bar, val in zip(bars, latencies):
        ax1.text(val + 0.1, bar.get_y() + bar.get_height()/2,
                 f"{val}s", va='center', fontsize=8.5, color=COLORS["text_dark"])
    ax1.set_xlabel("Latency (seconds)", fontsize=9)
    ax1.set_title("Response Latency by Task", fontsize=10, fontweight='bold',
                  color=COLORS["header"], pad=8)
    ax1.spines[['top', 'right']].set_visible(False)
    ax1.set_facecolor('#F8FAFF')

    # ── Subplot 2: Retrieval Accuracy (F1) ──
    ax2 = axes[1]
    doc_types = ["Standard\nPDF", "Scanned\nPDF (VLM)", "Handwritten\nDocs", "Mixed\nDocs"]
    f1_scores = [0.86, 0.72, 0.59, 0.79]
    colors_r = [COLORS["box_green"], COLORS["box_teal"], COLORS["box_red"], COLORS["box_blue"]]
    bars2 = ax2.bar(doc_types, f1_scores, color=colors_r, edgecolor='white', width=0.55)
    for bar, val in zip(bars2, f1_scores):
        ax2.text(bar.get_x() + bar.get_width()/2, val + 0.01,
                 f"{val:.2f}", ha='center', va='bottom', fontsize=9,
                 fontweight='bold', color=COLORS["text_dark"])
    ax2.set_ylim(0, 1.05)
    ax2.axhline(0.45, color=COLORS["box_orange"], linestyle='--', linewidth=1.2, alpha=0.8)
    ax2.text(3.4, 0.47, "threshold", fontsize=7.5, color=COLORS["box_orange"])
    ax2.set_ylabel("F1 Score", fontsize=9)
    ax2.set_title("RAG Retrieval Accuracy\nby Document Type", fontsize=10, fontweight='bold',
                  color=COLORS["header"], pad=8)
    ax2.spines[['top', 'right']].set_visible(False)
    ax2.set_facecolor('#F8FAFF')

    # ── Subplot 3: VRAM Usage ──
    ax3 = axes[2]
    models = ["TinyLlama\n1.1B (Q4)", "Mistral\n7B (Q4)", "Llama3\n8B (Q4)",
              "LLava\n7B (Q4)", "nomic-\nembed"]
    vram = [1.2, 5.1, 6.3, 5.8, 0.6]
    colors_v = [COLORS["box_green"], COLORS["box_teal"], COLORS["box_purple"],
                COLORS["box_blue"], COLORS["box_green"]]
    bars3 = ax3.barh(models, vram, color=colors_v, edgecolor='white', height=0.55)
    for bar, val in zip(bars3, vram):
        ax3.text(val + 0.05, bar.get_y() + bar.get_height()/2,
                 f"{val} GB", va='center', fontsize=8.5, color=COLORS["text_dark"])
    ax3.axvline(12, color=COLORS["box_red"], linestyle='--', linewidth=1.2, alpha=0.7)
    ax3.text(12.05, -0.4, "RTX 3060\nVRAM limit\n(12 GB)", fontsize=7,
             color=COLORS["box_red"], va='bottom')
    ax3.set_xlabel("VRAM Usage (GB)", fontsize=9)
    ax3.set_xlim(0, 13.5)
    ax3.set_title("GPU Memory Footprint\nby Model", fontsize=10, fontweight='bold',
                  color=COLORS["header"], pad=8)
    ax3.spines[['top', 'right']].set_visible(False)
    ax3.set_facecolor('#F8FAFF')

    plt.tight_layout(rect=[0, 0, 1, 0.95])
    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  FLOWCHART 7 – User Request Decision Tree
# ══════════════════════════════════════════════════════
def make_fc7_user_decision_tree(out_path):
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 9)
    ax.axis('off')
    fig.patch.set_facecolor('#FFF3E0')

    ax.text(7, 8.65, "User Task Routing — Feature Decision Tree",
            ha='center', va='center', fontsize=15, fontweight='bold',
            color=COLORS["header"])

    def box(x, y, w, h, label, color, fs=8.5):
        p = FancyBboxPatch((x - w/2, y - h/2), w, h,
                           boxstyle="round,pad=0.09",
                           facecolor=color, edgecolor='white',
                           linewidth=1.8, zorder=3)
        ax.add_patch(p)
        ax.text(x, y, label, ha='center', va='center',
                fontsize=fs, color='white', fontweight='bold',
                zorder=4, linespacing=1.3)

    def arr(x1, y1, x2, y2, lbl="", color=COLORS["arrow"], rad=0):
        style = f"arc3,rad={rad}"
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.6,
                                   connectionstyle=style, mutation_scale=17), zorder=2)
        if lbl:
            mx, my = (x1+x2)/2, (y1+y2)/2
            ax.text(mx+0.05, my, lbl, fontsize=7.5, color=color,
                    ha='left', va='center', fontstyle='italic', zorder=5)

    # Root
    box(7, 8.15, 3, 0.65, "💬 User Input", COLORS["box_orange"], 11)

    # Level 1 branches
    tasks = [
        (1.2,  6.5, "Chat /\nQ&A",           COLORS["box_blue"]),
        (3.5,  6.5, "Upload\nDocument",       COLORS["box_green"]),
        (5.8,  6.5, "Summarize\nText/URL",    COLORS["box_teal"]),
        (8.2,  6.5, "Generate\nWebsite",      COLORS["box_purple"]),
        (10.5, 6.5, "Process\nImage",         COLORS["box_orange"]),
        (12.8, 6.5, "Translate\nText",        COLORS["box_gray"]),
    ]

    for x, y, lbl, col in tasks:
        box(x, y, 1.8, 0.75, lbl, col)
        arr(7, 7.82, x, 6.88, rad=(0.2 if x < 7 else -0.2))

    # Level 2 — sub options
    # Chat branches
    box(0.7, 4.8, 1.4, 0.6, "Offline\nOllama", COLORS["box_green"])
    box(2.2, 4.8, 1.4, 0.6, "Hybrid\nGroq/OAI", COLORS["box_blue"])
    arr(1.2, 6.12, 0.7, 5.1, "offline")
    arr(1.2, 6.12, 2.2, 5.1, "online")

    # Document branches
    box(3.0, 4.8, 1.4, 0.6, "Standard\nPDF", COLORS["box_green"])
    box(4.5, 4.8, 1.4, 0.6, "Scanned\nVLM OCR", COLORS["box_purple"])
    arr(3.5, 6.12, 3.0, 5.1, "text")
    arr(3.5, 6.12, 4.5, 5.1, "scanned")

    # Summarize branches
    box(5.3, 4.8, 1.4, 0.6, "Local\nText", COLORS["box_green"])
    box(6.8, 4.8, 1.4, 0.6, "URL/YouTube\n(internet)", COLORS["box_red"])
    arr(5.8, 6.12, 5.3, 5.1, "offline")
    arr(5.8, 6.12, 6.8, 5.1, "online")

    # Web creator
    box(8.2, 4.8, 1.8, 0.6, "Generate\nHTML/CSS/JS", COLORS["box_purple"])
    arr(8.2, 6.12, 8.2, 5.1, "")

    # Image processing
    box(9.8,  4.8, 1.4, 0.6, "Remove\nBackground", COLORS["box_teal"])
    box(11.3, 4.8, 1.4, 0.6, "Generate\nImage (SD)", COLORS["box_blue"])
    arr(10.5, 6.12, 9.8, 5.1, "bg remove")
    arr(10.5, 6.12, 11.3, 5.1, "generate")

    # Translate
    box(12.8, 4.8, 1.8, 0.6, "Local Model\nTranslation", COLORS["box_gray"])
    arr(12.8, 6.12, 12.8, 5.1, "")

    # Common output
    box(7, 3.2, 4, 0.75, "⚙️ FastAPI Backend\nProcess & Respond", COLORS["box_blue"])
    for x, *_ in tasks:
        arr(x, 4.4, 7, 3.58, rad=(0.1 if x < 7 else -0.1), color=COLORS["box_blue"])

    box(7, 1.9, 3, 0.65, "✅ Result to\nUser", COLORS["box_green"])
    arr(7, 2.82, 7, 2.23)

    # Legend
    for i, (lbl, col) in enumerate([
        ("Offline Only", COLORS["box_green"]),
        ("Requires Internet", COLORS["box_red"]),
        ("Either Mode", COLORS["box_blue"]),
    ]):
        lx = 1.2 + i * 4
        ax.add_patch(FancyBboxPatch((lx, 0.3), 0.35, 0.28,
                                    boxstyle="round,pad=0.04",
                                    facecolor=col, edgecolor='none'))
        ax.text(lx + 0.45, 0.44, lbl, va='center', fontsize=8.5, color=COLORS["text_dark"])

    save_fig(fig, out_path)


# ══════════════════════════════════════════════════════
#  BUILD ENHANCED PDF
# ══════════════════════════════════════════════════════
def build_pdf_with_flowcharts(source_pdf, output_pdf, flowchart_images):
    """
    Opens source_pdf with PyMuPDF and inserts flowchart pages at strategic
    locations throughout the document.
    """
    doc = fitz.open(source_pdf)
    total_pages = len(doc)
    print(f"Original PDF has {total_pages} pages.")

    # We'll insert flowcharts as whole new pages at the end of relevant sections.
    # Strategy: insert after specific pages (0-indexed in original).
    # We'll collect insertion instructions and do them back-to-front to preserve indices.

    # Each entry: (after_page_0idx, image_path, caption)
    # We'll insert them in REVERSE order of page index to avoid shifting
    insertions = [
        # After Introduction section (page ~2)
        (2,  flowchart_images[6],  "Figure A1: User Task Routing — Feature Decision Tree"),
        # After System Architecture (page ~4)
        (4,  flowchart_images[0],  "Figure A2: Enhanced System Architecture Diagram"),
        # After VLM OCR section (page ~5)
        (5,  flowchart_images[1],  "Figure A3: VLM-Based OCR Pipeline"),
        # After Multi-Agent section (page ~8)
        (8,  flowchart_images[2],  "Figure A4: Multi-Agent Routing & RAG Query Flow"),
        # After Document Ingestion (page ~6)
        (6,  flowchart_images[3],  "Figure A5: RAG Document Ingestion Pipeline"),
        # After Mode discussion (page ~7)
        (7,  flowchart_images[4],  "Figure A6: Operational Mode Selection"),
        # After Results section (page ~10)
        (10, flowchart_images[5],  "Figure A7: Performance Benchmark Charts"),
    ]

    # Sort by page index descending so we insert back-to-front
    insertions_sorted = sorted(insertions, key=lambda x: x[0], reverse=True)

    for after_page, img_path, caption in insertions_sorted:
        insert_idx = min(after_page + 1, len(doc))
        print(f"  Inserting '{caption}' at page index {insert_idx}")

        # Create new page (A4)
        new_page = doc.new_page(insert_idx, width=595, height=842)

        # Header bar
        new_page.draw_rect(fitz.Rect(0, 0, 595, 30),
                           color=None, fill=(0.102, 0.137, 0.494))  # dark navy

        new_page.insert_text((20, 20), "Offline AI Digital Brain — Research Paper",
                              fontsize=10, color=(1, 1, 1))

        # Insert flowchart image
        rect = fitz.Rect(30, 40, 565, 760)
        new_page.insert_image(rect, filename=img_path)

        # Caption
        new_page.insert_text((30, 775), caption,
                              fontsize=9, color=(0.102, 0.137, 0.494))
        new_page.insert_text((30, 788),
                              "Offline AI Digital Brain | Architecture & Flow Diagrams",
                              fontsize=7.5, color=(0.5, 0.5, 0.5))

        # Footer line
        new_page.draw_line(fitz.Point(30, 798), fitz.Point(565, 798),
                           color=(0.102, 0.137, 0.494), width=0.8)

    doc.save(output_pdf, garbage=4, deflate=True)
    doc.close()
    print(f"\n✅ Enhanced PDF saved to: {output_pdf}")
    print(f"   Total pages: {total_pages} original + {len(insertions)} flowchart pages")


# ══════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════
if __name__ == "__main__":
    base_dir    = Path(r"c:\Users\Amrutha\Desktop\ai_brain-main")
    source_pdf  = base_dir / "Offline_AI_Digital_Brain_Research_Paper.pdf"
    output_pdf  = base_dir / "Offline_AI_Digital_Brain_Research_Paper_With_Flowcharts.pdf"
    img_dir     = base_dir / "flowchart_images"
    img_dir.mkdir(exist_ok=True)

    print("=" * 60)
    print("  Generating Flowcharts for Research Paper")
    print("=" * 60)

    flowchart_paths = [
        str(img_dir / "fc1_system_architecture.png"),
        str(img_dir / "fc2_vlm_ocr_pipeline.png"),
        str(img_dir / "fc3_multi_agent_rag.png"),
        str(img_dir / "fc4_rag_ingestion.png"),
        str(img_dir / "fc5_mode_decision.png"),
        str(img_dir / "fc6_performance_chart.png"),
        str(img_dir / "fc7_user_decision_tree.png"),
    ]

    generators = [
        make_fc1_system_architecture,
        make_fc2_vlm_ocr_pipeline,
        make_fc3_multi_agent_rag,
        make_fc4_rag_ingestion,
        make_fc5_mode_decision,
        make_fc6_performance_chart,
        make_fc7_user_decision_tree,
    ]

    for gen, path in zip(generators, flowchart_paths):
        print(f"\n[+] Generating: {Path(path).stem}")
        gen(path)

    print("\n" + "=" * 60)
    print("  Building Enhanced PDF")
    print("=" * 60)
    build_pdf_with_flowcharts(str(source_pdf), str(output_pdf), flowchart_paths)
    print("\nDone! 🎉")
