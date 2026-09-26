import Link from "next/link";
export default function NotFound() {
  return (
    <div className="boot-screen">
      <h1>Page not found</h1>
      <Link className="button primary" href="/">
        Return to Home
      </Link>
    </div>
  );
}
