import type { Note } from "@/data/types";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_ ]/gi, "").slice(0, 60) || "note";
}

export async function exportNoteAsPdf(note: Note): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const html2canvasMod = await import("html2canvas-pro");
  const html2canvas = html2canvasMod.default;

  const ReactDOMClient = await import("react-dom/client");
  const React = await import("react");
  const ReactMarkdownMod = await import("react-markdown");
  const ReactMarkdown = ReactMarkdownMod.default;
  const remarkGfm = (await import("remark-gfm")).default;
  const remarkMath = (await import("remark-math")).default;
  const rehypeKatex = (await import("rehype-katex")).default;
  const remarkEmoji = (await import("remark-emoji")).default;
  await import("katex/dist/katex.min.css");

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "800px";
  container.style.padding = "48px";
  container.style.background = "#ffffff";
  container.style.color = "#0a0a0a";
  container.style.fontFamily = "ui-sans-serif, system-ui, -apple-system";
  container.style.fontSize = "14px";
  container.style.lineHeight = "1.6";
  document.body.appendChild(container);

  const root = ReactDOMClient.createRoot(container);
  root.render(
    React.createElement(
      "div",
      { className: "prose max-w-none" },
      React.createElement(
        "h1",
        {
          style: {
            fontSize: "24px",
            fontWeight: 600,
            marginBottom: "8px",
          },
        },
        note.title,
      ),
      React.createElement(
        "p",
        { style: { fontSize: "12px", color: "#6b7280", marginBottom: "24px" } },
        new Date(note.last_modified_at).toLocaleString(),
      ),
      React.createElement(
        ReactMarkdown,
        {
          remarkPlugins: [remarkGfm, remarkEmoji, remarkMath],
          rehypePlugins: [rehypeKatex],
        },
        note.content || "_(empty note)_",
      ),
    ),
  );

  await new Promise((r) => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const imgW = pageW - 48 * 2;
    const ratio = imgW / canvas.width;
    const imgH = canvas.height * ratio;

    let y = 48;
    const imgData = canvas.toDataURL("image/png");

    if (imgH <= pageH - 48 * 2) {
      pdf.addImage(imgData, "PNG", 48, y, imgW, imgH);
    } else {
      let remaining = canvas.height;
      let sY = 0;
      const pagePxH = (pageH - 48 * 2) / ratio;
      while (remaining > 0) {
        const sliceH = Math.min(pagePxH, remaining);
        const slice = document.createElement("canvas");
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext("2d");
        if (!ctx) break;
        ctx.drawImage(
          canvas,
          0,
          sY,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH,
        );
        const slicedData = slice.toDataURL("image/png");
        pdf.addImage(slicedData, "PNG", 48, y, imgW, sliceH * ratio);
        remaining -= sliceH;
        sY += sliceH;
        if (remaining > 0) {
          pdf.addPage();
          y = 48;
        }
      }
    }

    pdf.save(`${sanitizeFilename(note.title)}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
