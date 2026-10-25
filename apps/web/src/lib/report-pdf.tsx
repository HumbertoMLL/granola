import "server-only";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  formatIndicatorRange,
  type Indicator,
  type ReportBrand,
} from "@granola/core/documents";

const styles = StyleSheet.create({
  page: {
    padding: 42,
    paddingBottom: 65,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#2B2118",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderBottomWidth: 3,
    paddingBottom: 18,
    marginBottom: 24,
  },
  logo: { width: 52, height: 52, objectFit: "contain" },
  title: {
    fontSize: 24,
    lineHeight: 1.3,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
  },
  subtitle: { color: "#7A6E63", fontSize: 10, lineHeight: 1.4 },
  row: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E0D2",
  },
  values: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: "Helvetica-Bold", maxWidth: "60%" },
  comment: { marginTop: 5, color: "#514638" },
  section: {
    fontSize: 14,
    lineHeight: 1.4,
    fontFamily: "Helvetica-Bold",
    marginTop: 24,
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 42,
    right: 42,
    fontSize: 8,
    lineHeight: 1.3,
    color: "#7A6E63",
    borderTopWidth: 1,
    borderTopColor: "#E8E0D2",
    paddingTop: 8,
    height: 26,
  },
});
type ReportInput = {
  template: "inbody" | "labs";
  content: Indicator[];
  interpretation: string;
  brand: ReportBrand;
  nutritionistId: string;
};
/** Solo avatares propios alojados en R2. Sin fetch de URLs arbitrarias del editor. */
async function logoSource(r: ReportInput): Promise<string | null> {
  if (!r.brand.logo_url || !process.env.R2_PUBLIC_URL) return null;
  const allowed = `${process.env.R2_PUBLIC_URL.replace(/\/+$/, "")}/avatars/${r.nutritionistId}/`;
  if (!r.brand.logo_url.startsWith(allowed)) return null;
  const response = await fetch(r.brand.logo_url, {
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (
    !response.ok ||
    !["image/png", "image/jpeg"].includes(
      response.headers.get("content-type") ?? "",
    )
  )
    return null;
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 2 * 1024 * 1024) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return `data:${response.headers.get("content-type")};base64,${Buffer.concat(chunks).toString("base64")}`;
}
export async function renderReport(report: ReportInput, patientName: string) {
  const logo = await logoSource(report).catch(() => null);
  return renderToBuffer(
    <Document title="Reporte personalizado" author={report.brand.firma}>
      <Page size="A4" style={styles.page} wrap>
        <View
          style={[styles.header, { borderBottomColor: report.brand.color }]}
        >
          {/* React-PDF Image genera contenido de PDF, no un img de HTML. */}
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          {logo && <Image src={logo} style={styles.logo} />}
          <View>
            <Text style={[styles.title, { color: report.brand.color }]}>
              {report.template === "inbody"
                ? "Composición corporal"
                : "Análisis de laboratorio"}
            </Text>
            <Text style={styles.subtitle}>Reporte personalizado</Text>
          </View>
        </View>
        <Text
          style={{ fontSize: 16, lineHeight: 1.35, fontFamily: "Helvetica-Bold" }}
        >
          {patientName}
        </Text>
        <Text style={styles.subtitle}>{report.brand.firma}</Text>
        <Text style={styles.section}>Indicadores revisados</Text>
        {report.content
          .filter((i) => i.visible)
          .map((i) => (
            <View key={i.clave} style={styles.row} wrap={false}>
              <View style={styles.values}>
                <Text style={styles.label}>{i.etiqueta}</Text>
                <Text>
                  {i.valor} {i.unidad}
                </Text>
              </View>
              <Text style={styles.subtitle}>
                Referencia: {formatIndicatorRange(i)}
              </Text>
              {i.comentario && (
                <Text style={styles.comment}>{i.comentario}</Text>
              )}
            </View>
          ))}
        {report.interpretation && (
          <View>
            <Text style={[styles.section, { color: report.brand.color }]}>
              Mi interpretación
            </Text>
            <Text>{report.interpretation}</Text>
          </View>
        )}
        <Text style={{ marginTop: 24 }}>{report.brand.firma}</Text>
        <View style={styles.footer} fixed>
          <Text style={{ fontSize: 8, lineHeight: 1.3 }}>Reporte elaborado por tu profesional de nutrición</Text>
        </View>
      </Page>
    </Document>,
  );
}
