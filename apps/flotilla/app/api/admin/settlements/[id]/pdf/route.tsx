import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin-auth";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#555", marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: "#ddd" },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#333", paddingBottom: 4, marginBottom: 4 },
  cell: { flex: 1 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalsEmphasis: { fontSize: 13, fontWeight: 700 },
  signature: { marginTop: 60, borderTopWidth: 1, borderTopColor: "#333", width: 220, paddingTop: 4, textAlign: "center" },
});

function money(value: number | null) {
  return `$${(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireAdmin();
  if (!caller) {
    return NextResponse.json({ error: "Solo un administrador puede descargar liquidaciones." }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: settlement } = await supabase
    .from("settlements")
    .select(
      "id, start_date, end_date, status, fuel_cost, variable_expenses, total_freight, total_advances, final_payout, driver:drivers(full_name, commission_percentage)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!settlement || settlement.status !== "completed") {
    return NextResponse.json({ error: "La liquidación no existe o todavía no está sellada." }, { status: 404 });
  }

  const [{ data: trips }, { data: advances }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, trip_value, invoice_number, created_at, vehicle:vehicles(license_plate)")
      .eq("settlement_id", id)
      .order("created_at"),
    supabase
      .from("driver_advances")
      .select("id, amount, description, created_at")
      .eq("settlement_id", id)
      .order("created_at"),
  ]);

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Recibo de Liquidación</Text>
        <Text style={styles.subtitle}>
          {settlement.driver?.full_name} · {new Date(settlement.start_date).toLocaleDateString()} –{" "}
          {new Date(settlement.end_date).toLocaleDateString()}
        </Text>

        <Text style={styles.sectionTitle}>Fletes</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cell}>Fecha</Text>
          <Text style={styles.cell}>Vehículo</Text>
          <Text style={styles.cell}>Factura</Text>
          <Text style={styles.cell}>Valor</Text>
        </View>
        {(trips ?? []).map((t) => (
          <View style={styles.row} key={t.id}>
            <Text style={styles.cell}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</Text>
            <Text style={styles.cell}>{t.vehicle?.license_plate ?? "—"}</Text>
            <Text style={styles.cell}>{t.invoice_number ?? "—"}</Text>
            <Text style={styles.cell}>{money(t.trip_value)}</Text>
          </View>
        ))}

        {(advances ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Anticipos</Text>
            {(advances ?? []).map((a) => (
              <View style={styles.row} key={a.id}>
                <Text style={styles.cell}>{a.description || "Anticipo"}</Text>
                <Text style={styles.cell}>{money(a.amount)}</Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.totalsRow}>
          <Text>Ingreso Bruto (fletes)</Text>
          <Text>{money(settlement.total_freight)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text>Combustible</Text>
          <Text>- {money(settlement.fuel_cost)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text>Otros gastos variables</Text>
          <Text>- {money(settlement.variable_expenses)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text>Comisión ({settlement.driver?.commission_percentage}%)</Text>
          <Text>
            {money(
              (settlement.final_payout ?? 0) + (settlement.total_advances ?? 0),
            )}
          </Text>
        </View>
        <View style={styles.totalsRow}>
          <Text>Anticipos</Text>
          <Text>- {money(settlement.total_advances)}</Text>
        </View>
        <View style={styles.totalsRow}>
          <Text style={styles.totalsEmphasis}>Total a Pagar</Text>
          <Text style={styles.totalsEmphasis}>{money(settlement.final_payout)}</Text>
        </View>

        <View style={styles.signature}>
          <Text>Firma del conductor</Text>
        </View>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="liquidacion-${id.slice(0, 8)}.pdf"`,
    },
  });
}
