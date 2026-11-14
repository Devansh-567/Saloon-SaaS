import Link from "next/link";

export function Pagination({
  page,
  pages,
  total,
  basePath,
  params = {},
}: {
  page: number;
  pages: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (pages <= 1) {
    return (
      <div className="pagination">
        <span>{total} result{total === 1 ? "" : "s"}</span>
        <span>Page 1 of 1</span>
      </div>
    );
  }

  const href = (target: number) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="pagination">
      <span>
        {total} result{total === 1 ? "" : "s"} · page {page} of {pages}
      </span>
      <div className="pager">
        {page > 1 ? <Link href={href(page - 1)}>Prev</Link> : <span aria-disabled="true">Prev</span>}
        <span className="current">{page}</span>
        {page < pages ? <Link href={href(page + 1)}>Next</Link> : <span aria-disabled="true">Next</span>}
      </div>
    </div>
  );
}
