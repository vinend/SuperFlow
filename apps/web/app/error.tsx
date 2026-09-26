"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="boot-screen">
      <h1>Workspace could not load</h1>
      <p>Try loading this page again.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
