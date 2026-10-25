"use client";

type Point = {
  id: string;
  measuredAt: Date;
  weightKg: string | null;
  waistCm: string | null;
  bodyFatPct?: string | null;
  muscleKg?: string | null;
};
export function MeasurementChart({
  rows,
  timezone,
  includeComposition = false,
}: {
  rows: Point[];
  timezone: string;
  includeComposition?: boolean;
}) {
  const series = [
    { key: "weightKg", label: "Peso", unit: "kg", color: "#4a7a2b" },
    { key: "waistCm", label: "Cintura", unit: "cm", color: "#a86710" },
    ...(includeComposition
      ? ([
          {
            key: "bodyFatPct",
            label: "Grasa corporal",
            unit: "%",
            color: "#c15e43",
          },
          {
            key: "muscleKg",
            label: "Masa muscular",
            unit: "kg",
            color: "#6b4fd8",
          },
        ] as const)
      : []),
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {series.map((s) => {
        const points = rows.filter((r) => r[s.key] != null);
        if (!points.length)
          return (
            <p key={s.key} className="text-sm text-muted-foreground">
              Sin datos de {s.label.toLowerCase()}.
            </p>
          );
        const values = points.map((p) => Number(p[s.key]));
        const min = Math.min(...values) - 1,
          max = Math.max(...values) + 1;
        const start = points[0]!.measuredAt.getTime(),
          end = points[points.length - 1]!.measuredAt.getTime();
        const coords = points.map((p) => ({
          row: p,
          x:
            end === start
              ? 160
              : 38 + ((p.measuredAt.getTime() - start) / (end - start)) * 244,
          y: 120 - ((Number(p[s.key]) - min) / (max - min)) * 90,
        }));
        const date = (d: Date) =>
          new Intl.DateTimeFormat("es-MX", {
            timeZone: timezone,
            day: "numeric",
            month: "short",
            year: "2-digit",
          }).format(d);
        return (
          <figure key={s.key} className="min-w-0">
            <figcaption className="font-semibold">
              {s.label} ({s.unit})
            </figcaption>
            <svg
              viewBox="0 0 320 165"
              className="w-full"
              role="img"
              aria-label={`Evolución de ${s.label.toLowerCase()} en ${s.unit}`}
            >
              <text x="0" y="25" fontSize="11" fill="currentColor">
                {max.toFixed(1)}
              </text>
              <text x="0" y="125" fontSize="11" fill="currentColor">
                {min.toFixed(1)}
              </text>
              <path
                d="M38 20 V130 H288"
                fill="none"
                stroke="currentColor"
                opacity="0.2"
              />
              <polyline
                points={coords.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
              />
              {coords.map((p) => (
                <circle key={p.row.id} cx={p.x} cy={p.y} r="4" fill={s.color}>
                  <title>
                    {date(p.row.measuredAt)}: {p.row[s.key]} {s.unit}
                  </title>
                </circle>
              ))}
              <text x="38" y="151" fontSize="10" fill="currentColor">
                {date(points[0]!.measuredAt)}
              </text>
              <text
                x="282"
                y="151"
                textAnchor="end"
                fontSize="10"
                fill="currentColor"
              >
                {date(points[points.length - 1]!.measuredAt)}
              </text>
            </svg>
            <p className="text-xs text-muted-foreground">
              {points.length} registros · {values[values.length - 1]} {s.unit}{" "}
              en el más reciente
            </p>
          </figure>
        );
      })}
    </div>
  );
}
