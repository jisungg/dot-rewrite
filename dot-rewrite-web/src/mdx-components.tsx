import type { MDXComponents } from "mdx/types";
import Image from "next/image";
import Link from "next/link";

const headingBase = "font-medium tracking-tight text-zinc-900";
const paragraphBase = "text-md text-slate-600 leading-relaxed my-4";
const listBase = "list-disc list-inside text-slate-600";
const codeBlockBase =
  "bg-transparent rounded-md border border-zinc-200 text-sm text-zinc-800 p-4 my-4 overflow-x-auto";
const inlineCodeBase =
  "bg-transparent rounded-md border border-zinc-200 text-zinc-800 px-1.5 py-0.5 font-mono text-sm";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    h1: ({ children, ...props }) => (
      <h1 className={`text-3xl ${headingBase} mb-6`} {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className={`text-2xl ${headingBase} mb-4`} {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className={`text-xl ${headingBase} mb-3`} {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className={`text-lg ${headingBase} mb-2`} {...props}>
        {children}
      </h4>
    ),
    h5: ({ children, ...props }) => (
      <h5 className={`text-base ${headingBase} mb-2`} {...props}>
        {children}
      </h5>
    ),
    h6: ({ children, ...props }) => (
      <h6 className={`text-sm ${headingBase} mb-2`} {...props}>
        {children}
      </h6>
    ),
    p: ({ children, ...props }) => (
      <p className={paragraphBase} {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className={`${listBase} my-4`} {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-inside text-slate-600 my-4" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="my-1" {...props}>
        {children}
      </li>
    ),
    a: ({ href, children, ...props }) => (
      <Link
        href={href ?? "#"}
        className="text-[#0061ff] hover:underline transition-all"
        {...props}
      >
        {children}
      </Link>
    ),
    pre: ({ children, ...props }) => (
      <pre className={codeBlockBase} {...props}>
        {children}
      </pre>
    ),
    code: ({ children, ...props }) => (
      <code className={inlineCodeBase} {...props}>
        {children}
      </code>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-[#0061ff] bg-zinc-50 px-4 py-2 italic text-slate-600 my-6"
        {...props}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => <hr className="my-8 border-t border-slate-200" {...props} />,
    img: (props) => (
      <Image
        src={typeof props.src === "string" ? props.src : ""}
        alt={props.alt ?? ""}
        width={800}
        height={600}
        className="rounded-md my-4"
      />
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-auto my-4">
        <table className="min-w-full divide-y divide-slate-200" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead className="bg-slate-50" {...props}>
        {children}
      </thead>
    ),
    tbody: ({ children, ...props }) => (
      <tbody className="bg-white divide-y divide-slate-200" {...props}>
        {children}
      </tbody>
    ),
    tr: ({ children, ...props }) => <tr {...props}>{children}</tr>,
    th: ({ children, ...props }) => (
      <th
        className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide"
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-4 py-2 text-sm text-slate-600" {...props}>
        {children}
      </td>
    ),
    details: ({ children, ...props }) => (
      <details
        className="my-4 rounded-md border border-slate-200 p-4"
        {...props}
      >
        {children}
      </details>
    ),
    summary: ({ children, ...props }) => (
      <summary className="cursor-pointer font-semibold" {...props}>
        {children}
      </summary>
    ),
  };
}
