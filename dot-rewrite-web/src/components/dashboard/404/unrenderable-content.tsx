import Link from "next/link";

export default function UnrenderableContent() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 text-center">
        You&apos;ve reached an unknown place in your notes.
      </h2>
      <p className="text-zinc-500 dark:text-zinc-400 text-center">
        We don&apos;t know how or why you&apos;re here, let&apos;s get
        <br />
        <Link
          href="/dashboard"
          className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
        >
          {" "}
          back to your notes
        </Link>
        .
      </p>
    </div>
  );
}
