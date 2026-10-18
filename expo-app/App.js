import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView, ScrollView, View, Text, Pressable, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import BUNDLED from "./data/dados.json";

// Dados atualizados pelo site (GitHub Pages). Se não conseguir, usa os dados que vieram no app.
const REMOTE_URL = "https://riltonfi.github.io/bicho-bahia/dados.json";

const ORDEM = ["10h", "11h Federal", "12h", "15h", "19h", "20h Federal", "21h"];
const DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const BANCAS = {
  pt: { nome: "Paratodos", tipo: "Loteria normal", cor: "#0B4F9C", soft: "#E3EEFB" },
  ma: { nome: "Maluca", tipo: "Loteria Maluca", cor: "#8A1766", soft: "#F9E4F1" },
};
const pad = (n, l) => String(n).padStart(l, "0");
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const lbl = (h) => (h.includes("Federal") ? "Federal " + h.split(" ")[0] : h);
const fmtDia = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  const w = new Date(y, m - 1, dd).getDay();
  return { curto: `${DIAS_SEM[w]} ${pad(dd, 2)}/${pad(m, 2)}`, longo: `${DIAS_SEM[w]}, ${dd} de ${MESES[m - 1]} de ${y}` };
};
const horasDo = (days, d) => {
  const set = new Set();
  ["pt", "ma"].forEach((k) => Object.keys((days[d] && days[d][k]) || {}).forEach((h) => set.add(h)));
  return ORDEM.filter((h) => set.has(h));
};

export default function App() {
  const [days, setDays] = useState(BUNDLED);
  const [dia, setDia] = useState(Object.keys(BUNDLED).sort().pop());
  const [hora, setHora] = useState("21h");
  const [view, setView] = useState("both");
  const [q, setQ] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState("");

  useEffect(() => {
    let cancel = false;
    fetch(REMOTE_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => {
        if (cancel || !json || !Object.keys(json).length) return;
        setDays(json);
        const ultimo = Object.keys(json).sort().pop();
        setDia(ultimo);
        setAtualizadoEm("Atualizado com dados até " + fmtDia(ultimo).curto);
      })
      .catch(() => setAtualizadoEm("Sem internet: mostrando os dados guardados no app"))
      .finally(() => !cancel && setCarregando(false));
    return () => (cancel = true);
  }, []);

  const dias = useMemo(() => Object.keys(days).sort().reverse(), [days]);
  const hs = horasDo(days, dia);
  const horaAtiva = hs.includes(hora) ? hora : hs[0];

  const match = (row) => {
    const t = norm(q);
    if (!t) return false;
    const [m, g, a] = row;
    if (/^\d+$/.test(t)) return t.length <= 2 ? g === Number(t) || pad(m, 4).endsWith(pad(t, 2)) : pad(m, 4).includes(t);
    return norm(a).includes(t);
  };

  const card = (k) => {
    const rows = ((days[dia] || {})[k] || {})[horaAtiva];
    const b = BANCAS[k];
    return (
      <View key={k} style={[styles.card, { borderColor: b.cor }]}>
        <View style={[styles.head, { backgroundColor: b.cor }]}>
          <Text style={styles.headName}>{b.nome.toUpperCase()}</Text>
          <Text style={styles.headKind}>{b.tipo}</Text>
          <Text style={styles.when}>Sorteio das {lbl(horaAtiva)} · {fmtDia(dia).curto}</Text>
        </View>
        {!rows ? (
          <Text style={styles.empty}>Sem resultado deste sorteio neste dia.</Text>
        ) : (
          <>
            <View style={[styles.first, match(rows[0]) && styles.hit]}>
              <Text style={styles.firstLbl}>1º prêmio</Text>
              <Text style={styles.big}>{pad(rows[0][0], 4)}</Text>
              <Text style={styles.firstAn}>Grupo {pad(rows[0][1], 2)} · {rows[0][2]}</Text>
            </View>
            {rows.slice(1).map((r, i) => (
              <View key={i} style={[styles.row, i % 2 === 0 && { backgroundColor: b.soft }, match(r) && styles.hit]}>
                <Text style={styles.pos}>{i + 2}º</Text>
                <Text style={styles.num}>{pad(r[0], 4)}</Text>
                <Text style={styles.an}>Grupo {pad(r[1], 2)} · {r[2]}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const freq = (k) => {
    const cnt = {};
    Object.values((days[dia] || {})[k] || {}).forEach((d) => d.forEach(([m, g, a]) => { cnt[g] = cnt[g] || { a, n: 0 }; cnt[g].n++; }));
    const top = Object.entries(cnt).sort((x, y) => y[1].n - x[1].n || x[0] - y[0]).slice(0, 5);
    return (
      <View key={k} style={[styles.card, { borderColor: BANCAS[k].cor, marginBottom: 14 }]}>
        <View style={[styles.head, { backgroundColor: BANCAS[k].cor }]}>
          <Text style={styles.headName}>{BANCAS[k].nome.toUpperCase()}</Text>
          <Text style={styles.headKind}>Bichos que mais saíram neste dia</Text>
        </View>
        {top.length ? top.map(([g, o]) => (
          <View key={g} style={styles.rankRow}>
            <Text style={styles.rankTxt}>Grupo {pad(g, 2)} · {o.a}</Text>
            <Text style={styles.rankTxt}>{o.n} vezes</Text>
          </View>
        )) : <Text style={styles.empty}>Sem dados</Text>}
      </View>
    );
  };

  const achados = q.trim()
    ? ["pt", "ma"].map((k) => {
        const w = hs.filter((h) => (((days[dia] || {})[k] || {})[h] || []).some(match));
        return { k, w };
      })
    : [];

  if (carregando && !atualizadoEm) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.dayBar}>
          <Text style={styles.dayTop}>RESULTADOS DO BICHO NA BAHIA</Text>
          <Text style={styles.dayDate}>{fmtDia(dia).longo}</Text>
          {!!atualizadoEm && <Text style={styles.dayNote}>{atualizadoEm}</Text>}
        </View>

        <Text style={styles.h2}>1. Escolha o dia</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {dias.map((d) => (
            <Choice key={d} label={fmtDia(d).curto} active={d === dia} onPress={() => setDia(d)} w={118} />
          ))}
        </ScrollView>

        <Text style={styles.h2}>2. Escolha o horário</Text>
        <View style={styles.grid}>
          {hs.map((h) => (
            <Choice key={h} label={lbl(h)} active={h === horaAtiva} onPress={() => setHora(h)} />
          ))}
        </View>

        <Text style={styles.h2}>3. O que você quer ver?</Text>
        <View style={styles.grid}>
          {[["both", "As duas"], ["pt", "Só Paratodos"], ["ma", "Só Maluca"]].map(([v, t]) => (
            <Choice key={v} label={t} active={view === v} onPress={() => setView(v)} />
          ))}
        </View>

        {(view === "both" ? ["pt", "ma"] : [view]).map((k) => card(k))}

        <Text style={styles.h2}>Procurar um número ou bicho</Text>
        <Text style={styles.hint}>Digite um número (como 4400 ou 22) ou o nome de um bicho (como tigre).</Text>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Digite aqui"
          placeholderTextColor="#5B6B65"
          style={styles.input}
          autoCorrect={false}
        />
        {!!q.trim() && achados.map(({ k, w }) => (
          <Text key={k} style={styles.found}>
            <Text style={{ fontWeight: "700", color: BANCAS[k].cor }}>{BANCAS[k].nome}: </Text>
            {w.length ? `"${q.trim()}" saiu às ${w.map(lbl).join(", ")}.` : "não saiu neste dia."}
          </Text>
        ))}

        <Text style={[styles.h2, { marginTop: 18 }]}>Bichos que mais saíram</Text>
        {(view === "both" ? ["pt", "ma"] : [view]).map((k) => freq(k))}

        <Text style={styles.note}>Fonte: resultadofacil.com.br. Conteúdo para maiores de 18 anos.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Choice({ label, active, onPress, w }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceOn, w && { width: w }]}>
      <Text style={[styles.choiceTxt, active && styles.choiceTxtOn]}>{active ? "✓ " : ""}{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F2F4F7" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F7" },
  wrap: { padding: 16, paddingBottom: 48, gap: 12 },
  dayBar: { backgroundColor: "#0B1620", borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 4 },
  dayTop: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  dayDate: { color: "#FFFFFF", fontSize: 24, fontWeight: "700", marginTop: 4, textAlign: "center" },
  dayNote: { color: "#C3D0DC", fontSize: 14, marginTop: 6, textAlign: "center" },
  h2: { fontSize: 20, fontWeight: "700", color: "#0B1620", marginTop: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 58, minWidth: 100, paddingHorizontal: 12, justifyContent: "center", alignItems: "center", borderRadius: 12, borderWidth: 3, borderColor: "#9AA7B4", backgroundColor: "#FFFFFF", flexGrow: 1 },
  choiceOn: { backgroundColor: "#0B1620", borderColor: "#0B1620" },
  choiceTxt: { fontSize: 18, fontWeight: "700", color: "#0B1620" },
  choiceTxtOn: { color: "#FFFFFF" },
  card: { borderWidth: 3, borderRadius: 16, overflow: "hidden", backgroundColor: "#FFFFFF" },
  head: { padding: 14, gap: 2 },
  headName: { color: "#FFFFFF", fontSize: 22, fontWeight: "700", letterSpacing: 1 },
  headKind: { color: "#FFFFFF", fontSize: 16 },
  when: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginTop: 6 },
  first: { backgroundColor: "#FFE07A", padding: 16, borderBottomWidth: 3, borderBottomColor: "#9AA7B4" },
  firstLbl: { fontSize: 16, fontWeight: "700", color: "#0B1620" },
  big: { fontSize: 46, fontWeight: "700", letterSpacing: 4, color: "#0B1620" },
  firstAn: { fontSize: 20, fontWeight: "700", color: "#0B1620" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 16, gap: 8 },
  pos: { width: 44, fontSize: 17, fontWeight: "700", color: "#0B1620" },
  num: { fontSize: 24, fontWeight: "700", letterSpacing: 2, color: "#0B1620", width: 96 },
  an: { flex: 1, fontSize: 17, color: "#38454F" },
  hit: { backgroundColor: "#FFD23F" },
  empty: { padding: 16, fontSize: 17, color: "#38454F" },
  rankRow: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderTopWidth: 2, borderTopColor: "#F0F4F8" },
  rankTxt: { fontSize: 17, color: "#0B1620" },
  hint: { fontSize: 17, color: "#38454F" },
  input: { fontSize: 20, borderWidth: 3, borderColor: "#9AA7B4", borderRadius: 12, paddingHorizontal: 14, minHeight: 58, backgroundColor: "#FFFFFF", color: "#0B1620" },
  found: { fontSize: 18, color: "#0B1620", backgroundColor: "#FFFFFF", padding: 12, borderRadius: 12, borderWidth: 2, borderColor: "#9AA7B4" },
  note: { fontSize: 14, color: "#38454F", marginTop: 12 },
});
