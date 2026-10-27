type SearchResponseProps = {
  query: string;
  answer?: string;
  images?: string[];
  results: Array<{
    title?: string;
    snippet?: string;
    url?: string;
    image?: string;
  }>;
};

export function SearchResponse({
  answer,
  images,
  query,
  results,
}: SearchResponseProps) {
  const displayImages = (images || []).filter(Boolean);
  const sources = results.filter((r) => r.url).slice(0, 6);

  return (
    <div className="w-full max-w-[580px] space-y-5 animate-[fade-up_0.3s_ease-out]">
      {/* Titre */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border/30" />
        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
          Résultats pour « {query} »
        </h2>
        <div className="h-px flex-1 bg-border/30" />
      </div>

      {/* Images */}
      {displayImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {displayImages.slice(0, 5).map((img) => (
            <a
              className="shrink-0 overflow-hidden rounded-xl border border-border/20 transition-all hover:border-border/50 hover:shadow-md"
              href={img}
              key={img}
              rel="noopener noreferrer"
              style={{ width: 120, height: 100 }}
              target="_blank"
            >
              <div
                className="size-full bg-cover bg-center"
                style={{ backgroundImage: `url(${img})` }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Réponse rédigée */}
      {answer && (
        <div className="text-[14px] leading-relaxed text-foreground/90">
          {answer}
        </div>
      )}

      {/* Sources */}
      {sources.length > 0 && (
        <div className="space-y-1">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
            Sources
          </h3>
          <div className="space-y-px">
            {sources.map((source) => {
              const hostname = (() => {
                try {
                  return source.url
                    ? new URL(source.url).hostname.replace("www.", "")
                    : "";
                } catch {
                  return "";
                }
              })();

              return (
                <a
                  className="group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/30"
                  href={source.url || "#"}
                  key={source.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {source.image && (
                    <div
                      className="shrink-0 size-10 rounded-lg bg-cover bg-center bg-muted/30"
                      style={{ backgroundImage: `url(${source.image})` }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="truncate text-[10px] text-muted-foreground/40">
                        {hostname}
                      </span>
                    </div>
                    <div className="line-clamp-1 text-[13px] font-medium text-foreground/80 leading-snug transition-colors group-hover:text-primary">
                      {source.title}
                    </div>
                    {source.snippet && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/50">
                        {source.snippet}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
