"""One-off script to generate docs/Compounding_Support_Desk.pptx. Not part of the app build."""

from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
import os

TEAL = RGBColor(0x0D, 0x94, 0x88)
TEAL_DARK = RGBColor(0x0F, 0x76, 0x6E)
TEAL_SOFT = RGBColor(0xF0, 0xFD, 0xFA)
INK = RGBColor(0x0F, 0x17, 0x2A)
SUBTLE = RGBColor(0x64, 0x74, 0x8B)
BG = RGBColor(0xF5, 0xF7, 0xFA)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GREEN = RGBColor(0x16, 0x65, 0x34)
AMBER = RGBColor(0x92, 0x40, 0x0E)

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
BLANK = prs.slide_layouts[6]


def add_slide(bg=BG):
    slide = prs.slides.add_slide(BLANK)
    rect = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, prs.slide_width, prs.slide_height)
    rect.fill.solid()
    rect.fill.fore_color.rgb = bg
    rect.line.fill.background()
    rect.shadow.inherit = False
    slide.shapes._spTree.remove(rect._element)
    slide.shapes._spTree.insert(2, rect._element)
    return slide


def add_text(slide, left, top, width, height, text, size=18, color=INK, bold=False, align=PP_ALIGN.LEFT, font="Arial", line_spacing=1.15):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.text = line
        p.alignment = align
        p.line_spacing = line_spacing
        for run in p.runs:
            run.font.size = Pt(size)
            run.font.bold = bold
            run.font.color.rgb = color
            run.font.name = font
    return box


def add_bullets(slide, left, top, width, height, items, size=16, color=INK, marker_color=TEAL_DARK, gap=8):
    box = slide.shapes.add_textbox(left, top, width, height)
    tf = box.text_frame
    tf.word_wrap = True
    for i, item in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.space_after = Pt(gap)
        p.line_spacing = 1.2
        run_mark = p.add_run()
        run_mark.text = "●  "
        run_mark.font.size = Pt(size - 4)
        run_mark.font.color.rgb = marker_color
        run_txt = p.add_run()
        run_txt.text = item
        run_txt.font.size = Pt(size)
        run_txt.font.color.rgb = color
    return box


def add_pill(slide, left, top, text, fg, bg_color, width=Inches(1.6), height=Inches(0.35)):
    shp = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    shp.adjustments[0] = 0.5
    shp.fill.solid()
    shp.fill.fore_color.rgb = bg_color
    shp.line.fill.background()
    shp.shadow.inherit = False
    tf = shp.text_frame
    tf.word_wrap = False
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    run = p.add_run()
    run.text = text
    run.font.size = Pt(11)
    run.font.bold = True
    run.font.color.rgb = fg
    return shp


def kicker_title(slide, kicker, title, title_color=INK):
    add_text(slide, Inches(0.7), Inches(0.35), Inches(8), Inches(0.35), kicker.upper(), size=13, color=TEAL_DARK, bold=True)
    add_text(slide, Inches(0.7), Inches(0.65), Inches(11.5), Inches(0.8), title, size=30, color=title_color, bold=True)


def footer(slide, n):
    add_text(slide, Inches(0.7), Inches(7.1), Inches(6), Inches(0.3), "Compounding Support Desk · RocketRide Hackathon", size=10, color=SUBTLE)
    add_text(slide, Inches(12.1), Inches(7.1), Inches(0.6), Inches(0.3), str(n), size=10, color=SUBTLE, align=PP_ALIGN.RIGHT)


# ---------------------------------------------------------------------------
# 1. Title
# ---------------------------------------------------------------------------
s = add_slide(bg=INK)
add_text(s, Inches(0.9), Inches(2.5), Inches(11.5), Inches(0.5), "ROCKETRIDE HACKATHON", size=16, color=RGBColor(0x5E, 0xEA, 0xD4), bold=True)
add_text(s, Inches(0.9), Inches(2.95), Inches(11.5), Inches(1.5), "Compounding Support Desk", size=48, color=WHITE, bold=True)
add_text(s, Inches(0.9), Inches(3.95), Inches(10.5), Inches(1.0), "An AI IT support assistant that gets faster every time a fix is verified — not just another ticket-triage chatbot.", size=18, color=RGBColor(0xCB, 0xD5, 0xE1))
add_text(s, Inches(0.9), Inches(6.6), Inches(8), Inches(0.4), "github.com/Thomaswu32/Data_hackthon", size=13, color=TEAL, bold=True)

# ---------------------------------------------------------------------------
# 2. The problem
# ---------------------------------------------------------------------------
s = add_slide()
kicker_title(s, "The problem", "Support teams keep re-solving the same tickets")
add_bullets(s, Inches(0.7), Inches(1.9), Inches(7.2), Inches(4.5), [
    "Every agent re-diagnoses from scratch, even for a symptom solved last week.",
    "“Looks similar” gets treated as “is the same” — wrong-system fixes get reused on the wrong ticket.",
    "AI suggestions get treated as confirmed fixes without a human ever verifying they worked.",
    "Knowledge lives in one agent's head, not in a form the next agent can trust.",
], size=17)
card = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8.3), Inches(1.9), Inches(4.3), Inches(3.4))
card.fill.solid(); card.fill.fore_color.rgb = WHITE; card.line.color.rgb = RGBColor(0xE2, 0xE8, 0xF0); card.line.width = Pt(1); card.shadow.inherit = False
add_text(s, Inches(8.6), Inches(2.1), Inches(3.7), Inches(0.4), "Scenario we solved end-to-end", size=13, color=TEAL_DARK, bold=True)
add_text(s, Inches(8.6), Inches(2.55), Inches(3.7), Inches(2.5), "“Employee reset their password but still can't log in to company systems.”", size=16, color=INK)
footer(s, 2)

# ---------------------------------------------------------------------------
# 3. The loop
# ---------------------------------------------------------------------------
s = add_slide()
kicker_title(s, "The solution", "A loop that compounds — not a one-off chatbot")
steps = ["Describe", "Diagnose", "Take action", "Confirm", "Save", "Reuse"]
descs = ["Free-text\n+ structured\nsystem/symptom", "History + live\ntrends + quick\nchecks", "Run approved\nsteps in a demo\nenvironment", "Human confirms\nit actually\nworked", "Verified fix\nbecomes a\nreusable playbook", "Next similar\nticket reuses it\ndirectly"]
n = len(steps)
box_w = Inches(1.85)
gap = Inches(0.15)
total = Emu(box_w.emu * n + gap.emu * (n - 1))
start_x = Emu((prs.slide_width.emu - total.emu) // 2)
y = Inches(2.3)
for i, (st, ds) in enumerate(zip(steps, descs)):
    x = Emu(start_x.emu + i * (box_w.emu + gap.emu))
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, y, box_w, Inches(2.0))
    box.fill.solid(); box.fill.fore_color.rgb = TEAL_SOFT if i < n - 1 else RGBColor(0xDC, 0xFC, 0xE7)
    box.line.color.rgb = TEAL if i < n - 1 else GREEN
    box.line.width = Pt(1.25)
    box.shadow.inherit = False
    tf = box.text_frame; tf.word_wrap = True; tf.vertical_anchor = MSO_ANCHOR.TOP
    tf.margin_top = Pt(14); tf.margin_left = Pt(8); tf.margin_right = Pt(8)
    p0 = tf.paragraphs[0]; p0.alignment = PP_ALIGN.CENTER
    r0 = p0.add_run(); r0.text = str(i + 1); r0.font.size = Pt(12); r0.font.bold = True; r0.font.color.rgb = TEAL_DARK
    p1 = tf.add_paragraph(); p1.alignment = PP_ALIGN.CENTER; p1.space_before = Pt(4)
    r1 = p1.add_run(); r1.text = st; r1.font.size = Pt(15); r1.font.bold = True; r1.font.color.rgb = INK
    p2 = tf.add_paragraph(); p2.alignment = PP_ALIGN.CENTER; p2.space_before = Pt(6)
    r2 = p2.add_run(); r2.text = ds; r2.font.size = Pt(10.5); r2.font.color.rgb = SUBTLE
    if i < n - 1:
        ax = Emu(x.emu + box_w.emu)
        arrow = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, Emu(ax.emu - Emu(Inches(0.03).emu) if False else ax.emu - 0), y + Inches(0.85), gap, Inches(0.3))
add_text(s, Inches(0.9), Inches(4.7), Inches(11.5), Inches(1.6),
         "Guardrail: reuse only fires on system + symptom + prerequisite-checklist match — never on text similarity alone. "
         "A wrong-system ticket with near-identical wording is a verified negative control in the check script.",
         size=15, color=SUBTLE)
footer(s, 3)

# ---------------------------------------------------------------------------
# 4-6. Screenshots
# ---------------------------------------------------------------------------
def screenshot_slide(title, sub, img, n):
    s = add_slide()
    kicker_title(s, "Live product", title)
    add_text(s, Inches(0.7), Inches(1.15), Inches(11), Inches(0.4), sub, size=14, color=SUBTLE)
    pic_path = os.path.join(DOCS, img)
    s.shapes.add_picture(pic_path, Inches(0.9), Inches(1.75), width=Inches(11.5))
    frame = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.9), Inches(1.75), Inches(11.5), Inches(6.4 * 1460 / 1460 * (812/1460)))
    footer(s, n)
    return s

screenshot_slide("Describe → one prompt, not a form", "“What's going wrong?” drives ticket creation; system/symptom stay structured pickers so matching stays trustworthy.", "screen-describe.jpg", 4)
screenshot_slide("Diagnose → quick checks + live workflow", "One question at a time, mass-incident alert, playbook match — and the right panel shows which services are actually running.", "screen-diagnose.jpg", 5)
screenshot_slide("Confirm → resolved, saved, logged", "“Fix saved for similar issues” only appears when the save genuinely succeeded. Technical details stay one click away, never dumped on the main view.", "screen-resolved.jpg", 6)

# ---------------------------------------------------------------------------
# 7. Architecture / five services
# ---------------------------------------------------------------------------
s = add_slide()
kicker_title(s, "Architecture", "Five services, one honest status per call")
services = [
    ("RocketRide", "Hosts the app, coordinates the AI-suggestion pipeline", TEAL_DARK),
    ("Cognee", "Finds and remembers similar past cases", TEAL_DARK),
    ("HydraDB", "Cross-session memory for verified resolutions", TEAL_DARK),
    ("Hotdata", "Real-time ticket volume / SLA / mass-incident signal", TEAL_DARK),
    ("Modiq", "Saves + matches verified, reusable playbooks", TEAL_DARK),
]
cols = 5
cw = Inches(2.2); ch = Inches(2.3); gap2 = Inches(0.15)
tot = Emu(cw.emu * cols + gap2.emu * (cols - 1))
sx = Emu((prs.slide_width.emu - tot.emu) // 2)
for i, (name, desc, col) in enumerate(services):
    x = Emu(sx.emu + i * (cw.emu + gap2.emu))
    y = Inches(2.1)
    circ = s.shapes.add_shape(MSO_SHAPE.OVAL, Emu(x.emu + Emu(cw.emu // 2) - Emu(Inches(0.45).emu)), y, Inches(0.9), Inches(0.9))
    circ.fill.solid(); circ.fill.fore_color.rgb = TEAL_SOFT; circ.line.color.rgb = col; circ.line.width = Pt(2); circ.shadow.inherit = False
    tf = circ.text_frame; p = tf.paragraphs[0]; p.alignment = PP_ALIGN.CENTER
    r = p.add_run(); r.text = name[:2]; r.font.bold = True; r.font.size = Pt(16); r.font.color.rgb = col
    box = s.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, x, Inches(3.15), cw, Inches(1.3))
    box.fill.solid(); box.fill.fore_color.rgb = WHITE; box.line.color.rgb = RGBColor(0xE2, 0xE8, 0xF0); box.line.width = Pt(1); box.shadow.inherit = False
    tf2 = box.text_frame; tf2.word_wrap = True; tf2.margin_top = Pt(10); tf2.margin_left = Pt(8); tf2.margin_right = Pt(8)
    p1 = tf2.paragraphs[0]; p1.alignment = PP_ALIGN.CENTER
    r1 = p1.add_run(); r1.text = name; r1.font.bold = True; r1.font.size = Pt(14); r1.font.color.rgb = INK
    p2 = tf2.add_paragraph(); p2.alignment = PP_ALIGN.CENTER; p2.space_before = Pt(4)
    r2 = p2.add_run(); r2.text = desc; r2.font.size = Pt(10.5); r2.font.color.rgb = SUBTLE
add_text(s, Inches(0.9), Inches(4.85), Inches(11.5), Inches(0.5), "Snyk runs separately as a project-level security scan — not part of the per-ticket workflow.", size=13, color=SUBTLE)
add_text(s, Inches(0.9), Inches(5.4), Inches(11.5), Inches(1.5),
         "Every node's state (idle / running / success / error / demo) is derived from the app's own real call log — no fixed timers, "
         "no scripted sequencing. Parallel calls light up multiple nodes at once because they really do run in parallel.",
         size=15, color=SUBTLE)
footer(s, 7)

# ---------------------------------------------------------------------------
# 8. Real vs demo status
# ---------------------------------------------------------------------------
s = add_slide()
kicker_title(s, "Honesty by design", "What's real, what's demo — no smoke and mirrors")
rows = [
    ("RocketRide", "Real", GREEN, "Live connect() + pipeline execution, verified from the CLI"),
    ("Hotdata", "Real", GREEN, "Genuine live computation over the ticket store, always"),
    ("Modiq", "Real", GREEN, "Genuine persistence + eligibility matching, always"),
    ("Cognee / HydraDB", "Real, via CLI", TEAL_DARK, "Gemini-backed pipelines proven real from scripts/check-loop"),
    ("Browser app today", "Demo-labeled", AMBER, "Real RocketRide shell package not yet vendored — UI never pretends otherwise"),
]
top = Inches(1.9)
rh = Inches(0.85)
for i, (name, status, col, note) in enumerate(rows):
    y = Emu(top.emu + i * rh.emu)
    row_bg = WHITE if i % 2 == 0 else RGBColor(0xF8, 0xFA, 0xFC)
    rect = s.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.7), y, Inches(11.9), rh)
    rect.fill.solid(); rect.fill.fore_color.rgb = row_bg; rect.line.fill.background(); rect.shadow.inherit = False
    add_text(s, Inches(0.9), Emu(y.emu + Pt(14).emu), Inches(3.0), Inches(0.5), name, size=15, bold=True, color=INK)
    add_pill(s, Inches(4.1), Emu(y.emu + Pt(10).emu), status, WHITE, col, width=Inches(1.9))
    add_text(s, Inches(6.3), Emu(y.emu + Pt(14).emu), Inches(6.1), Inches(0.6), note, size=12.5, color=SUBTLE)
footer(s, 8)

# ---------------------------------------------------------------------------
# 9. Verification
# ---------------------------------------------------------------------------
s = add_slide()
kicker_title(s, "Verification", "Proven, not promised")
add_bullets(s, Inches(0.7), Inches(1.9), Inches(11.7), Inches(4.5), [
    "pnpm --filter local-support-memory-desk run typecheck / build — strict TypeScript, clean Module Federation bundle",
    "pnpm run check — an 8-step Node harness: create → diagnose → confirm → execute → verify → save → reuse → negative control",
    "Idempotency: marking resolved twice never duplicates a playbook",
    "Persistence: closing and reopening the ticket store doesn't lose a saved playbook",
    "Snyk / pnpm audit: 14 real dependency vulnerabilities found and fixed (undici, adm-zip)",
    "Recorded live against the real RocketRide staging shell — see docs/demo.gif",
], size=17, gap=12)
footer(s, 9)

# ---------------------------------------------------------------------------
# 10. Close
# ---------------------------------------------------------------------------
s = add_slide(bg=INK)
add_text(s, Inches(0.9), Inches(2.7), Inches(11), Inches(1.0), "Every verified fix makes the next similar ticket faster.", size=32, color=WHITE, bold=True)
add_text(s, Inches(0.9), Inches(3.8), Inches(10), Inches(0.6), "github.com/Thomaswu32/Data_hackthon", size=18, color=TEAL, bold=True)
add_text(s, Inches(0.9), Inches(4.3), Inches(10), Inches(0.6), "Thank you — questions?", size=16, color=RGBColor(0xCB, 0xD5, 0xE1))

out_path = os.path.join(DOCS, "Compounding_Support_Desk.pptx")
prs.save(out_path)
print("Saved:", out_path)
