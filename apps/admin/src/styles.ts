import { colors, palette, radius } from '@passtra/brand';

/** Global CSS built from the shared passtra tokens (light + dark). */
const vars = (c: typeof colors.light) => `
  --bg:${c.background};--surface:${c.surface};--surface-alt:${c.surfaceAlt};--border:${c.border};--text:${c.text};
  --text-2:${c.textSecondary};--text-3:${c.textTertiary};--primary:${c.primary};--primary-text:${c.primaryText};
  --primary-soft:${c.primarySoft};--success:${c.success};--warning:${c.warning};--danger:${c.danger};`;

export const css = `
:root{${vars(colors.light)}--r-md:${radius.md}px;--r-lg:${radius.lg}px;--dark-blue:${palette.blueDark};color-scheme:light dark}
@media (prefers-color-scheme: dark){:root{${vars(colors.dark)}}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:500 14px/1.45 Manrope,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--primary-text);text-decoration:none}
.layout{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
.side{border-right:1px solid var(--border);padding:20px 14px;display:flex;flex-direction:column;gap:4px;position:sticky;top:0;height:100vh}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;font-size:20px;letter-spacing:-.5px;color:var(--dark-blue);padding:4px 8px 18px}
@media (prefers-color-scheme: dark){.brand{color:#fff}}
.logo{width:30px;height:30px;border-radius:9px;background:var(--primary);display:grid;place-items:center}
.nav{display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border-radius:10px;color:var(--text-2);cursor:pointer;border:0;background:none;font:inherit;text-align:left}
.nav:hover{background:var(--surface)}.nav.on{background:var(--primary-soft);color:var(--primary-text);font-weight:700}
.count{font-size:11px;font-weight:800;background:var(--primary);color:#fff;border-radius:99px;padding:1px 7px}
main{padding:28px 32px;max-width:1280px}
h1{font-size:26px;letter-spacing:-.6px;margin:0 0 4px}h2{font-size:17px;margin:24px 0 10px}
.muted{color:var(--text-2)}.small{font-size:12.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin:18px 0}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px}
.kpi{font-size:28px;font-weight:800;letter-spacing:-.8px}
table{width:100%;border-collapse:collapse;background:var(--bg)}
th,td{text-align:left;padding:10px 10px;border-bottom:1px solid var(--border);vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-3);font-weight:700}
.btn{border:0;border-radius:99px;padding:7px 14px;font:700 13px Manrope,system-ui;cursor:pointer;background:var(--primary);color:#fff}
.btn.sec{background:var(--primary-soft);color:var(--primary-text)}.btn.ghost{background:none;color:var(--primary-text)}.btn.danger{background:var(--danger)}
.btn:disabled{opacity:.5;cursor:default}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;border-radius:99px;padding:2px 8px;background:var(--surface-alt);color:var(--text-2)}
.b-ok{background:#E6F6EC;color:#12A150}.b-warn{background:#FFF4DB;color:#A06D00}.b-bad{background:#FDECEC;color:#D93A3A}.b-blue{background:var(--primary-soft);color:var(--primary-text)}
.bar{height:8px;border-radius:4px;background:var(--primary)}
.toast{position:fixed;bottom:20px;right:20px;background:var(--text);color:var(--bg);padding:12px 16px;border-radius:12px;font-weight:700}
.drawer{position:fixed;inset:0 0 0 auto;width:min(720px,100%);background:var(--bg);border-left:1px solid var(--border);overflow:auto;padding:24px;box-shadow:-20px 0 40px rgba(0,0,0,.08)}
input,textarea,select{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px 10px;width:100%}
label{display:block;font-size:12px;color:var(--text-2);margin:10px 0 4px}
code{font-size:12px;background:var(--surface-alt);padding:1px 5px;border-radius:6px}
pre{white-space:pre-wrap;word-break:break-word;font-size:12px;background:var(--surface);padding:12px;border-radius:10px;max-height:320px;overflow:auto}
`;
