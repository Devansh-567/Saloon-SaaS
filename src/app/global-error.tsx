"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          background: "#f7f4ef",
          color: "#1d2521",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 440 }}>
          <h1 style={{ fontSize: 28, marginBottom: 10, fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ color: "#4d5852", fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
            {error.message || "The application could not load. Please refresh or try again in a moment."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "10px 18px",
              fontSize: 13,
              fontWeight: 600,
              background: "#8c6a52",
              color: "#fffdf9",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest ? <p style={{ marginTop: 18, fontSize: 11.5, color: "#76817b" }}>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
