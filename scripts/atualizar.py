# Baixa os resultados dos últimos 30 dias (roda de hora em hora) do site e grava data.js.
# Mantém os dias já existentes e acrescenta/atualiza os novos.
import json, re, datetime, urllib.request
from html.parser import HTMLParser

BASE = "https://www.resultadofacil.com.br/resultados-jogo-do-bicho-paratodos-bahia/ba/do-dia/"
ORDEM = ["10h", "11h Federal", "12h", "15h", "19h", "20h Federal", "21h"]
DATA_JS = "data.js"

class Tabelas(HTMLParser):
    def __init__(self):
        super().__init__()
        self.titulo = ""          # último título (h1-h4) visto
        self.em_titulo = False
        self.tabelas = []         # (titulo, linhas)
        self.em_tabela = False
        self.linha = None
        self.celula = None
        self.linhas = None

    def handle_starttag(self, tag, attrs):
        if tag in ("h1", "h2", "h3", "h4", "h5", "strong"):
            self.em_titulo = True
            self.titulo_tmp = ""
        if tag == "table":
            self.em_tabela, self.linhas = True, []
        if tag == "tr" and self.em_tabela:
            self.linha = []
        if tag in ("td", "th") and self.linha is not None:
            self.celula = ""

    def handle_endtag(self, tag):
        if tag in ("h1", "h2", "h3", "h4", "h5", "strong") and self.em_titulo:
            self.em_titulo = False
            if "jogo do bicho" in self.titulo_tmp.lower():
                self.titulo = self.titulo_tmp.strip()
        if tag in ("td", "th") and self.celula is not None:
            self.linha.append(self.celula.strip()); self.celula = None
        if tag == "tr" and self.linha is not None:
            self.linhas.append(self.linha); self.linha = None
        if tag == "table" and self.em_tabela:
            self.em_tabela = False
            self.tabelas.append((self.titulo, self.linhas))

    def handle_data(self, data):
        if self.em_titulo:
            self.titulo_tmp += data
        if self.celula is not None:
            self.celula += data

def classificar(titulo):
    t = titulo.upper()
    m = re.search(r"(\d{1,2})\s*H", t)
    if not m:
        return None, None
    hora = f"{int(m.group(1))}h" + (" Federal" if "FEDERAL" in t else "")
    banca = "ma" if "MALUCA" in t else "pt"
    return banca, hora

def baixar(dia):
    with urllib.request.urlopen(BASE + dia, timeout=30) as r:
        html = r.read().decode("utf-8", "replace")
    p = Tabelas(); p.feed(html)
    out = {"pt": {}, "ma": {}}
    for titulo, linhas in p.tabelas:
        banca, hora = classificar(titulo)
        if not banca or hora not in ORDEM:
            continue
        rows = []
        for l in linhas:
            if len(l) >= 4 and re.fullmatch(r"\d{1,2}º?", l[0]) and l[1].isdigit():
                rows.append([int(l[1]), int(l[2]), l[3]])
        if len(rows) == 10:
            out[banca][hora] = rows
    return out if (out["pt"] or out["ma"]) else None

def carregar_atuais():
    try:
        txt = open(DATA_JS, encoding="utf-8").read()
        return json.loads(txt[txt.index("{"): txt.rindex("}") + 1])
    except Exception:
        return {}

def main():
    dias = carregar_atuais()
    hoje = datetime.date.today()
    for i in range(30):
        d = (hoje - datetime.timedelta(days=i)).isoformat()
        try:
            r = baixar(d)
            if r:
                dias[d] = r
                print("ok", d)
        except Exception as e:
            print("falhou", d, e)
    with open(DATA_JS, "w", encoding="utf-8") as f:
        f.write("const DAYS = " + json.dumps(dict(sorted(dias.items())), ensure_ascii=False) + ";\n")

if __name__ == "__main__":
    main()
